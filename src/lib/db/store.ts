import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { createSeedState } from "./seed";
import {
  flushRealtimeEventsToSupabase,
  publishRealtimeEvent,
} from "../realtime";
import { getSupabaseAdminClient } from "../supabase";
import { verifyRazorpaySignature, type SessionPayload } from "../auth";
import type {
  DatabaseState,
  LowStockFlag,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  PaymentChannel,
  RestaurantSettings,
  RestaurantTable,
  SessionBillSummary,
  TableSession,
  User,
  UserRole,
} from "../types";

const DATA_DIR =
  process.env.NETLIFY || process.env.VERCEL
    ? path.join(os.tmpdir(), "kora-restaurant-data")
    : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "kora-db.json");

declare global {
  // eslint-disable-next-line no-var
  var __koraDbState: DatabaseState | undefined;
  // eslint-disable-next-line no-var
  var __koraDbDirty: boolean | undefined;
  // eslint-disable-next-line no-var
  var __koraDbVersion: number | undefined;
}

const LEGACY_IMAGE_MAP: Record<string, string> = {
  "Guntur Chilli Chicken 65": "/dishes/chicken-65.jpg",
  "Crispy Lotus Stem Manchurian": "/dishes/lotus-stem.jpg",
  "24-Hour Black Dal Kora": "/dishes/black-dal.jpg",
  "Paneer Lababdar Reserve": "/dishes/paneer-lababdar.jpg",
  "Burnt Garlic & Sea Salt Naan": "/dishes/garlic-naan.jpg",
  "Flaky Malabar Parotta": "/dishes/malabar-parotta.jpg",
  "Kokum & Smoked Salt Fizz": "/dishes/kokum-fizz.jpg",
  "Madras Filter Coffee Tonic": "/dishes/filter-coffee-tonic.jpg",
  "Warm Saffron Rasmalai Tres Leches": "/dishes/saffron-rasmalai.jpg",
};

const STALE_PROCESSING_MS = 5 * 60_000; // 5 minutes

function reconcileStaleProcessingPayments(state: DatabaseState): boolean {
  let changed = false;
  const now = Date.now();
  const closedSessionIds = new Set(
    state.table_sessions.filter((s) => s.status === "closed").map((s) => s.id)
  );
  for (const p of state.payments) {
    if (p.status !== "processing") continue;
    const ageMs = now - new Date(p.created_at).getTime();
    if (closedSessionIds.has(p.session_id) || ageMs > STALE_PROCESSING_MS) {
      p.status = "failed";
      changed = true;
    }
  }
  return changed;
}

function healLegacyState(state: DatabaseState): boolean {
  let changed = false;
  for (const item of state.menu_items) {
    const fixed = LEGACY_IMAGE_MAP[item.name];
    if (fixed && item.image_url !== fixed && item.image_url.includes("unsplash.com")) {
      item.image_url = fixed;
      changed = true;
    }
    if (typeof item.stock_count !== "number" || !Number.isFinite(item.stock_count)) {
      item.stock_count = item.is_available ? 20 : 0;
      changed = true;
    }
  }
  if (!Array.isArray(state.low_stock_flags)) {
    state.low_stock_flags = [];
    changed = true;
  }
  for (const p of state.payments) {
    if (p.collected_by_name === "Razorpay UPI") {
      p.collected_by_name = "Demo Online (UPI)";
      changed = true;
    } else if (p.collected_by_name === "Razorpay Card") {
      p.collected_by_name = "Demo Online (Card)";
      changed = true;
    }
  }
  if (reconcileStaleProcessingPayments(state)) {
    changed = true;
  }
  for (const u of state.users) {
    if (u.role === "owner" && (u.full_name === "Arjun Mehta" || u.full_name === "Ajay" || u.email.toLowerCase() === "owner@kora.in")) {
      if (u.full_name !== "Yuvaraj") {
        u.full_name = "Yuvaraj";
        changed = true;
      }
    }
  }
  for (const exp of state.expenses) {
    if (exp.recorded_by === "Arjun Mehta" || exp.recorded_by === "Ajay") {
      exp.recorded_by = "Yuvaraj";
      changed = true;
    }
  }

  // Migrate location to Hyderabad
  if (
    state.settings.address.includes("Bengaluru") ||
    state.settings.address.includes("Indiranagar") ||
    state.settings.address.includes("560038")
  ) {
    state.settings.address = "Road No. 36, Jubilee Hills, Hyderabad 500033";
    state.settings.gstin = "36AABCK4821M1Z5";
    changed = true;
  }

  // Ensure Soft Drinks category exists
  let softDrinksCat = state.menu_categories.find(
    (c) => c.name.toLowerCase() === "soft drinks" || c.id === "33333333-3333-4333-8333-333333333307"
  );
  if (!softDrinksCat) {
    softDrinksCat = {
      id: "33333333-3333-4333-8333-333333333307",
      name: "Soft Drinks",
      description: "Chilled sodas, aerated colas & packaged natural mineral water",
      sort_order: 7,
      is_active: true,
    };
    state.menu_categories.push(softDrinksCat);
    changed = true;
  }

  // Ensure Thums Up, Pepsi, Water Bottle exist
  const requiredDrinks = [
    {
      name: "Thums Up",
      description: "Charged strong carbonated cola with an iconic punch of spicy fizz, served chilled (330ml).",
      price: 45,
      dietary: "veg" as const,
      spice_level: 0 as const,
      prep_minutes: 2,
      image_url: "/dishes/kokum-fizz.jpg",
      is_bestseller: true,
      is_available: true,
      stock_count: 60,
    },
    {
      name: "Pepsi",
      description: "Classic crisp refreshing cola with smooth bubbles, served chilled (330ml).",
      price: 45,
      dietary: "veg" as const,
      spice_level: 0 as const,
      prep_minutes: 2,
      image_url: "/dishes/filter-coffee-tonic.jpg",
      is_bestseller: false,
      is_available: true,
      stock_count: 60,
    },
    {
      name: "Water Bottle",
      description: "Packaged natural mineral water bottle, sealed and chilled (1000ml).",
      price: 25,
      dietary: "veg" as const,
      spice_level: 0 as const,
      prep_minutes: 1,
      image_url: "/dishes/kokum-fizz.jpg",
      is_bestseller: false,
      is_available: true,
      stock_count: 100,
    },
  ];

  for (const drink of requiredDrinks) {
    const exists = state.menu_items.some(
      (m) => !m.deleted_at && m.name.toLowerCase() === drink.name.toLowerCase()
    );
    if (!exists) {
      state.menu_items.push({
        id: crypto.randomUUID(),
        category_id: softDrinksCat.id,
        ...drink,
        deleted_at: null,
        variants: [],
        addons: [],
      });
      changed = true;
    }
  }
  return changed;
}

const DEFAULT_LOCAL_PASSWORDS: Record<string, string> = {
  "owner@kora.in": "Owner#kora",
  "manager@kora.in": "KoraManager#2026",
  "chef@kora.in": "KoraChef#2026",
  "staff@kora.in": "KoraStaff#2026",
  "ananya@kora.in": "KoraStaff#2026",
};

declare global {
  // eslint-disable-next-line no-var
  var __koraLocalPasswords: Record<string, string> | undefined;
}

export function registerLocalEmployeePassword(email: string, password: string): void {
  if (!globalThis.__koraLocalPasswords) {
    globalThis.__koraLocalPasswords = { ...DEFAULT_LOCAL_PASSWORDS };
  }
  globalThis.__koraLocalPasswords[email.trim().toLowerCase()] = password;
}

export function verifyLocalEmployeePassword(email: string, password: string): boolean {
  if (!globalThis.__koraLocalPasswords) {
    globalThis.__koraLocalPasswords = { ...DEFAULT_LOCAL_PASSWORDS };
  }
  const expected = globalThis.__koraLocalPasswords[email.trim().toLowerCase()];
  if (!expected || !password) return false;
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadStateFromDisk(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && Array.isArray(parsed.restaurant_tables) && Array.isArray(parsed.menu_items)) {
        if (healLegacyState(parsed)) {
          saveStateToDisk(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[KORA DB] Failed reading local state, falling back to seed:", err);
  }
  const seeded = createSeedState();
  saveStateToDisk(seeded);
  return seeded;
}

function saveStateToDisk(state: DatabaseState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
    } catch {
      console.warn("[KORA DB] Unable to persist DB file:", err);
    }
  }
}

/**
 * Loads latest authoritative state from Supabase PostgreSQL when configured.
 * On first boot against a fresh Supabase DB, automatically seeds initial restaurant data.
 */
export async function ensureDbReady(): Promise<DatabaseState> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return getDb();
  }

  let res = await supabase
    .from("kora_app_state")
    .select("version, payload")
    .eq("id", 1)
    .maybeSingle();

  if (res.error) {
    await new Promise((r) => setTimeout(r, 150));
    res = await supabase
      .from("kora_app_state")
      .select("version, payload")
      .eq("id", 1)
      .maybeSingle();
  }

  if (res.error) {
    console.error("[KORA Supabase] Read error (never reseeding on error):", res.error.message);
    if (globalThis.__koraDbState) {
      return globalThis.__koraDbState;
    }
    throw new Error(`Database read failed: ${res.error.message}`);
  }

  if (res.data && res.data.payload && Array.isArray((res.data.payload as DatabaseState).restaurant_tables)) {
    const loaded = res.data.payload as DatabaseState;
    const healed = healLegacyState(loaded);

    // IDEMPOTENT SYNC: Merge public.users without deleting or resetting existing records
    try {
      const { data: dbUsers } = await supabase.from("users").select("*");
      if (dbUsers && dbUsers.length > 0) {
        const existingEmails = new Set(loaded.users.map((u) => u.email.toLowerCase()));
        for (const u of dbUsers) {
          if (!existingEmails.has(u.email.toLowerCase())) {
            loaded.users.push({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: u.role,
              phone: u.phone,
              is_active: u.is_active,
              created_at: u.created_at,
            });
            existingEmails.add(u.email.toLowerCase());
          }
        }
      }
    } catch {
      // non-blocking
    }

    void ensureCoreAuthUsers();
    globalThis.__koraDbState = loaded;
    globalThis.__koraDbVersion = Number(res.data.version ?? 1);
    globalThis.__koraDbDirty = healed;
    return globalThis.__koraDbState;
  }

  // First-time Supabase initialization (table genuinely has 0 rows): seed & persist immediately
  const seeded = createSeedState();
  globalThis.__koraDbState = seeded;
  globalThis.__koraDbVersion = 1;
  globalThis.__koraDbDirty = false;
  const { error: seedErr } = await supabase.from("kora_app_state").upsert({
    id: 1,
    version: 1,
    payload: seeded,
    updated_at: new Date().toISOString(),
  });
  if (seedErr) {
    console.error("[KORA Supabase] Initial seed persist error:", seedErr.message);
  }
  void ensureCoreAuthUsers();
  return seeded;
}

let hasEnsuredAuthUsers = false;

export async function ensureCoreAuthUsers(): Promise<void> {
  if (hasEnsuredAuthUsers) return;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const coreAccounts: Array<{
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
  }> = [
    { email: "owner@kora.in", password: "Owner#kora", full_name: "Yuvaraj", role: "owner" },
    { email: "manager@kora.in", password: "KoraManager#2026", full_name: "Priya Nair", role: "manager" },
    { email: "chef@kora.in", password: "KoraChef#2026", full_name: "Chef Vikramaditya Rao", role: "chef" },
    { email: "staff@kora.in", password: "KoraStaff#2026", full_name: "Rohan Das", role: "staff" },
  ];

  try {
    const { data: existingList } = await supabase.auth.admin.listUsers({ perPage: 100 });
    const existingEmails = new Set(
      (existingList?.users ?? []).map((u) => u.email?.toLowerCase()).filter(Boolean)
    );

    for (const acc of coreAccounts) {
      // IDEMPOTENT GUARD: If account already exists in Supabase Auth, SKIP UNTOUCHED!
      // Never delete, disable, or reset password of existing account.
      if (existingEmails.has(acc.email.toLowerCase())) {
        if (acc.role === "owner") {
          const ownerAuth = existingList?.users.find((u) => u.email?.toLowerCase() === "owner@kora.in");
          if (ownerAuth && ownerAuth.user_metadata?.full_name !== acc.full_name) {
            try {
              await supabase.auth.admin.updateUserById(ownerAuth.id, {
                user_metadata: { full_name: acc.full_name },
              });
              await supabase.from("users").update({
                full_name: acc.full_name,
              }).eq("id", ownerAuth.id);
            } catch {
              // ignore
            }
          }
        }
        continue;
      }

      const { data: created, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        app_metadata: { role: acc.role },
        user_metadata: { full_name: acc.full_name },
      });

      if (!error && created?.user) {
        await supabase.from("users").upsert({
          id: created.user.id,
          full_name: acc.full_name,
          email: acc.email,
          role: acc.role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    hasEnsuredAuthUsers = true;
  } catch (err) {
    console.warn("[KORA Auth] Seed check completed with notice:", err);
  }
}

export function getDb(): DatabaseState {
  if (!globalThis.__koraDbState) {
    globalThis.__koraDbState = loadStateFromDisk();
  }
  return globalThis.__koraDbState;
}

export function commitDb(): void {
  globalThis.__koraDbDirty = true;
  if (globalThis.__koraDbState && !getSupabaseAdminClient()) {
    saveStateToDisk(globalThis.__koraDbState);
  }
}

/**
 * Persists mutated state to Supabase PostgreSQL & flushes Supabase Realtime events.
 * Always awaited by API routes before returning HTTP response so Vercel Lambdas never drop writes.
 */
export async function flushDb(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  if (globalThis.__koraDbDirty && globalThis.__koraDbState) {
    const nextVersion = (globalThis.__koraDbVersion ?? 1) + 1;
    const row = {
      id: 1,
      version: nextVersion,
      payload: globalThis.__koraDbState,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from("kora_app_state").upsert(row);
    if (error) {
      await new Promise((r) => setTimeout(r, 150));
      const retry = await supabase.from("kora_app_state").upsert(row);
      error = retry.error;
    }
    if (error) {
      console.error("[KORA Supabase] Persist error after retry:", error.message);
      throw new Error(`Database persist failed: ${error.message}`);
    } else {
      globalThis.__koraDbVersion = nextVersion;
      globalThis.__koraDbDirty = false;
    }
  }

  await flushRealtimeEventsToSupabase();
}

export function resetDemoDatabase(): DatabaseState {
  const currentUsers = globalThis.__koraDbState?.users ?? [];
  const seeded = createSeedState();

  // CRITICAL SEED SAFETY: Preserve all existing employee accounts & active statuses untouched
  if (currentUsers.length > 0) {
    const userMap = new Map<string, User>();
    for (const u of currentUsers) {
      userMap.set(u.email.toLowerCase(), u);
    }
    for (const s of seeded.users) {
      if (!userMap.has(s.email.toLowerCase())) {
        userMap.set(s.email.toLowerCase(), s);
      }
    }
    seeded.users = Array.from(userMap.values());
  }

  globalThis.__koraDbState = seeded;
  commitDb();
  publishRealtimeEvent({
    type: "table.updated",
    channel: "restaurant:tables",
    message: "Demo restaurant state reset to initial service snapshot",
  });
  return seeded;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function addAudit(
  db: DatabaseState,
  actor: { id: string | null; name: string; role: string },
  action: string,
  entity_type: string,
  entity_id: string,
  metadata: Record<string, unknown> = {}
) {
  db.audit_logs.unshift({
    id: crypto.randomUUID(),
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at: new Date().toISOString(),
  });
  if (db.audit_logs.length > 500) db.audit_logs.length = 500;
}

function logOrderStatus(
  db: DatabaseState,
  order_id: string,
  order_item_id: string | null,
  from_status: string | null,
  to_status: string,
  actor: { id: string | null; role: string },
  reason: string | null = null
) {
  db.order_status_logs.unshift({
    id: crypto.randomUUID(),
    order_id,
    order_item_id,
    from_status,
    to_status,
    actor_id: actor.id,
    actor_role: actor.role,
    reason,
    created_at: new Date().toISOString(),
  });
}

function recomputeParentOrderStatus(order: Order): void {
  const activeItems = order.items.filter(
    (i) => i.status !== "rejected" && i.status !== "cancelled"
  );
  if (activeItems.length === 0) return;

  if (activeItems.every((i) => i.status === "served")) {
    order.status = "served";
  } else if (activeItems.every((i) => i.status === "ready" || i.status === "served")) {
    order.status = "ready";
  } else if (
    activeItems.some((i) => i.status === "preparing" || i.status === "ready" || i.status === "served")
  ) {
    order.status = "preparing";
  } else if (activeItems.every((i) => i.status === "accepted")) {
    order.status = "accepted";
  }
  order.updated_at = new Date().toISOString();
}

// ============================================================================
// QR & TABLE SESSION OPERATIONS
// ============================================================================

export function resolveTableByQrToken(qrToken: string): {
  table: RestaurantTable;
  session: TableSession;
  createdNewSession: boolean;
} | null {
  const db = getDb();
  const table = db.restaurant_tables.find(
    (t) => t.qr_token === qrToken && t.is_active && t.status !== "inactive"
  );
  if (!table) return null;

  let session = db.table_sessions.find(
    (s) => s.table_id === table.id && (s.status === "active" || s.status === "payment_pending")
  );
  let createdNewSession = false;

  if (!session) {
    session = {
      id: crypto.randomUUID(),
      table_id: table.id,
      status: "active",
      guest_count: 2,
      bill_requested_at: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      closed_by: null,
    };
    db.table_sessions.push(session);
  table.status = "occupied";
  table.qr_token = crypto.randomUUID();
    createdNewSession = true;
    commitDb();

    publishRealtimeEvent({
      type: "session.opened",
      channel: "restaurant:tables",
      session_id: session.id,
      table_number: table.table_number,
      message: `${table.table_number} started a new dining session via QR`,
    });
  }

  return { table, session, createdNewSession };
}

export function getActiveSessionForTable(tableId: string): TableSession | null {
  const db = getDb();
  return (
    db.table_sessions.find(
      (s) => s.table_id === tableId && (s.status === "active" || s.status === "payment_pending")
    ) ?? null
  );
}

export function openTableSession(
  tableId: string,
  guestCount: number,
  actor: SessionPayload
): TableSession {
  const db = getDb();
  const table = db.restaurant_tables.find((t) => t.id === tableId && t.is_active);
  if (!table) throw new Error("Table not found or inactive");

  const existing = getActiveSessionForTable(tableId);
  if (existing) return existing;

  const session: TableSession = {
    id: crypto.randomUUID(),
    table_id: table.id,
    status: "active",
    guest_count: Math.max(1, guestCount || 2),
    bill_requested_at: null,
    opened_at: new Date().toISOString(),
    closed_at: null,
    closed_by: null,
  };
  db.table_sessions.push(session);
  table.status = "occupied";
  table.qr_token = crypto.randomUUID();

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "SESSION_OPENED",
    "table_session",
    session.id,
    { table_number: table.table_number, guest_count: session.guest_count }
  );
  commitDb();

  publishRealtimeEvent({
    type: "session.opened",
    channel: "restaurant:tables",
    session_id: session.id,
    table_number: table.table_number,
    message: `${table.table_number} session opened by ${actor.fullName}`,
  });

  return session;
}

export function closeTableSession(
  sessionId: string,
  actor: { id: string | null; name: string; role: string },
  options: { force?: boolean; reason?: string } = {}
): TableSession {
  const db = getDb();
  const session = db.table_sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Table session not found");
  if (session.status === "closed") return session;

  const bill = getSessionBillSummary(sessionId);
  if (bill.balance_due > 0.01 && !options.force) {
    throw new Error(
      `Cannot close table session while balance of ₹${bill.balance_due.toFixed(2)} is unpaid.`
    );
  }

  const table = db.restaurant_tables.find((t) => t.id === session.table_id);
  session.status = "closed";
  session.closed_at = new Date().toISOString();
  session.closed_by = actor.id;

  // Mark all served orders in this session as completed
  for (const order of db.orders) {
    if (order.session_id === sessionId && order.status === "served") {
      order.status = "completed";
      order.updated_at = new Date().toISOString();
    }
  }

  // Expire any abandoned in-flight processing payment attempts on this closed session
  for (const p of db.payments) {
    if (p.session_id === sessionId && p.status === "processing") {
      p.status = "failed";
    }
  }

  if (table && table.is_active) {
    table.status = "available";
    table.qr_token = crypto.randomUUID();
   table.qr_token = crypto.randomUUID();
  }

  addAudit(
    db,
    actor,
    options.force ? "SESSION_FORCE_CLOSED" : "SESSION_CLOSED",
    "table_session",
    session.id,
    {
      table_number: table?.table_number ?? "Unknown",
      grand_total: bill.grand_total,
      amount_paid: bill.amount_paid,
      balance_due: bill.balance_due,
      reason: options.reason ?? null,
    }
  );
  commitDb();

  publishRealtimeEvent({
    type: "session.closed",
    channel: "restaurant:tables",
    session_id: session.id,
    table_number: table?.table_number,
    message: `${table?.table_number ?? "Table"} session closed & table available`,
  });

  return session;
}

export function regenerateTableQr(tableId: string, actor: SessionPayload): RestaurantTable {
  const db = getDb();
  const table = db.restaurant_tables.find((t) => t.id === tableId);
  if (!table) throw new Error("Table not found");
  const oldToken = table.qr_token;
  table.qr_token = crypto.randomUUID();

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "QR_TOKEN_REGENERATED",
    "restaurant_table",
    table.id,
    { table_number: table.table_number, previous_token_prefix: oldToken.slice(0, 8) }
  );
  commitDb();

  publishRealtimeEvent({
    type: "table.updated",
    channel: "restaurant:tables",
    table_number: table.table_number,
    message: `QR code regenerated for ${table.table_number}`,
  });

  return table;
}

// ============================================================================
// CUSTOMER ORDERING (SERVER-AUTHORITATIVE PRICING)
// ============================================================================

export interface CreateOrderItemInput {
  menu_item_id: string;
  variant_id?: string | null;
  addon_ids?: string[];
  quantity: number;
  instructions?: string | null;
}

export function createCustomerOrder(
  sessionId: string,
  itemsInput: CreateOrderItemInput[],
  specialInstructions?: string | null
): Order {
  const db = getDb();
  const session = db.table_sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Table session not found. Please re-scan the table QR.");
  if (session.status === "closed") {
    throw new Error("This table session has already closed. Scan the table QR to start a new session.");
  }

  const table = db.restaurant_tables.find((t) => t.id === session.table_id);
  if (!table || !table.is_active) throw new Error("Table is inactive.");

  if (!itemsInput.length) throw new Error("Cart is empty.");

  const orderId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const input of itemsInput) {
    const qty = Math.floor(Number(input.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      throw new Error("Invalid item quantity.");
    }
    const menuItem = db.menu_items.find(
      (m) => m.id === input.menu_item_id && !m.deleted_at
    );
    if (!menuItem) throw new Error("One of the selected menu items no longer exists.");
    if (!menuItem.is_available || (typeof menuItem.stock_count === "number" && menuItem.stock_count <= 0)) {
      throw new Error(`"${menuItem.name}" is currently sold out.`);
    }

    let variantName: string | null = null;
    let variantDelta = 0;
    if (input.variant_id && menuItem.variants.length > 0) {
      const variant = menuItem.variants.find((v) => v.id === input.variant_id);
      if (variant) {
        variantName = variant.name;
        variantDelta = variant.price_delta;
      }
    } else if (menuItem.variants.length > 0) {
      const def = menuItem.variants.find((v) => v.is_default) ?? menuItem.variants[0];
      variantName = def.name;
      variantDelta = def.price_delta;
    }

    const orderItemId = crypto.randomUUID();
    const resolvedAddons = (input.addon_ids ?? [])
      .map((aid) => menuItem.addons.find((a) => a.id === aid))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({
        id: crypto.randomUUID(),
        order_item_id: orderItemId,
        addon_name_snapshot: a.name,
        addon_price: a.price,
      }));

    const addonsTotal = resolvedAddons.reduce((sum, a) => sum + a.addon_price, 0);
    const unitPrice = roundMoney(menuItem.price + variantDelta + addonsTotal);
    const itemTotal = roundMoney(unitPrice * qty);
    subtotal = roundMoney(subtotal + itemTotal);

    orderItems.push({
      id: orderItemId,
      order_id: orderId,
      menu_item_id: menuItem.id,
      item_name_snapshot: menuItem.name,
      variant_name_snapshot: variantName,
      quantity: qty,
      unit_price: unitPrice,
      item_total: itemTotal,
      status: "pending_approval",
      instructions: input.instructions?.trim() || null,
      addons: resolvedAddons,
      started_at: null,
      ready_at: null,
      served_at: null,
      served_by: null,
    });
  }

  const taxAmount = roundMoney((subtotal * db.settings.tax_rate_percent) / 100);
  const serviceCharge = roundMoney((subtotal * db.settings.service_charge_percent) / 100);
  const totalAmount = roundMoney(subtotal + taxAmount + serviceCharge);

  const order: Order = {
    id: orderId,
    session_id: session.id,
    table_id: table.id,
    table_number: table.table_number,
    order_number: db.next_order_number++,
    status: "pending_approval",
    subtotal,
    tax_amount: taxAmount,
    service_charge: serviceCharge,
    total_amount: totalAmount,
    special_instructions: specialInstructions?.trim() || null,
    rejection_reason: null,
    cancellation_reason: null,
    approved_by: null,
    items: orderItems,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // Reopen active dining if customer ordered more food after previously requesting bill
  if (session.status === "payment_pending") {
    session.status = "active";
  }

  db.orders.unshift(order);
  logOrderStatus(
    db,
    order.id,
    null,
    null,
    "pending_approval",
    { id: null, role: "customer" },
    `Order #${order.order_number} placed from ${table.table_number}`
  );
  commitDb();

  publishRealtimeEvent({
    type: "order.created",
    channel: "restaurant:kitchen",
    session_id: session.id,
    table_number: table.table_number,
    order_number: order.order_number,
    message: `New Order #${order.order_number} from ${table.table_number} (${orderItems.length} items) — awaiting Chef approval`,
  });

  return order;
}

// ============================================================================
// CHEF KITCHEN WORKFLOW (APPROVAL + ITEM-LEVEL PREP & READINESS)
// ============================================================================

export function acceptOrderByChef(orderId: string, actor: SessionPayload): Order {
  const db = getDb();
  if (!["chef", "owner", "staff", "manager"].includes(actor.role)) {
    throw new Error("Only the Chef, Staff, Manager, or Owner can accept kitchen orders.");
  }
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending_approval") {
    throw new Error(`Order #${order.order_number} is already ${order.status}.`);
  }

  const nowIso = new Date().toISOString();
  order.status = "accepted";
  order.approved_by = actor.userId;
  order.updated_at = nowIso;

  let stockBecameZero = false;
  for (const item of order.items) {
    if (item.status === "pending_approval") {
      item.status = "accepted";
      db.kitchen_tickets.push({
        id: crypto.randomUUID(),
        order_id: order.id,
        order_item_id: item.id,
        chef_id: actor.userId,
        status: "queued",
        created_at: nowIso,
        updated_at: nowIso,
      });

      // Auto-decrement dish stock count on acceptance; auto-mark Sold Out at 0
      const menuItem = db.menu_items.find((m) => m.id === item.menu_item_id && !m.deleted_at);
      if (menuItem) {
        const nextCount = Math.max(0, (menuItem.stock_count ?? 0) - item.quantity);
        menuItem.stock_count = nextCount;
        if (nextCount === 0 && menuItem.is_available) {
          menuItem.is_available = false;
          stockBecameZero = true;
        }
        for (const flag of db.low_stock_flags) {
          if (flag.menu_item_id === menuItem.id && flag.status === "open") {
            flag.current_stock_count = nextCount;
          }
        }
      }
    }
  }

  if (stockBecameZero) {
    publishRealtimeEvent({
      type: "menu.updated",
      channel: "restaurant:orders",
      message: "One or more dishes reached 0 stock and were marked Sold Out automatically",
    });
  }

  logOrderStatus(
    db,
    order.id,
    null,
    "pending_approval",
    "accepted",
    { id: actor.userId, role: actor.role },
    actor.role === "owner" ? "Owner override approval" : "Accepted by Chef"
  );

  if (actor.role === "owner") {
    addAudit(
      db,
      { id: actor.userId, name: actor.fullName, role: actor.role },
      "ORDER_APPROVAL_OVERRIDE",
      "order",
      order.id,
      { order_number: order.order_number, table_number: order.table_number }
    );
  }

  commitDb();

  publishRealtimeEvent({
    type: "order.accepted",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `Order #${order.order_number} (${order.table_number}) accepted by Kitchen`,
  });

  return order;
}

export function rejectOrderByChef(
  orderId: string,
  reason: string,
  actor: SessionPayload
): Order {
  const db = getDb();
  if (!["chef", "owner", "staff", "manager"].includes(actor.role)) {
    throw new Error("Only the Chef, Staff, Manager, or Owner can reject kitchen orders.");
  }
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("A rejection reason is mandatory.");

  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending_approval") {
    throw new Error("Only pending orders can be rejected by the kitchen.");
  }

  order.status = "rejected";
  order.rejection_reason = cleanReason;
  order.updated_at = new Date().toISOString();
  for (const item of order.items) {
    item.status = "rejected";
  }

  logOrderStatus(
    db,
    order.id,
    null,
    "pending_approval",
    "rejected",
    { id: actor.userId, role: actor.role },
    cleanReason
  );
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "ORDER_REJECTED",
    "order",
    order.id,
    { order_number: order.order_number, table_number: order.table_number, reason: cleanReason }
  );
  commitDb();

  publishRealtimeEvent({
    type: "order.rejected",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `Order #${order.order_number} (${order.table_number}) rejected: ${cleanReason}`,
  });

  return order;
}

export function rejectSingleItemByChef(
  itemId: string,
  reason: string,
  actor: SessionPayload
): Order {
  const db = getDb();
  if (actor.role !== "chef" && actor.role !== "owner") {
    throw new Error("Only the Chef can reject individual items.");
  }
  const order = db.orders.find((o) => o.items.some((i) => i.id === itemId));
  if (!order) throw new Error("Order item not found");
  const item = order.items.find((i) => i.id === itemId)!;

  const prev = item.status;
  item.status = "rejected";
  item.instructions = `${item.instructions ? `${item.instructions} · ` : ""}[Rejected: ${reason}]`;

  // Recalculate order totals excluding rejected items
  const activeSubtotal = roundMoney(
    order.items
      .filter((i) => i.status !== "rejected" && i.status !== "cancelled")
      .reduce((s, i) => s + i.item_total, 0)
  );
  order.subtotal = activeSubtotal;
  order.tax_amount = roundMoney((activeSubtotal * db.settings.tax_rate_percent) / 100);
  order.service_charge = roundMoney((activeSubtotal * db.settings.service_charge_percent) / 100);
  order.total_amount = roundMoney(order.subtotal + order.tax_amount + order.service_charge);

  const remainingActive = order.items.filter(
    (i) => i.status !== "rejected" && i.status !== "cancelled"
  );
  if (remainingActive.length === 0) {
    order.status = "rejected";
    order.rejection_reason = reason;
  } else {
    recomputeParentOrderStatus(order);
  }

  logOrderStatus(
    db,
    order.id,
    item.id,
    prev,
    "rejected",
    { id: actor.userId, role: actor.role },
    reason
  );
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "ORDER_ITEM_REJECTED",
    "order_item",
    item.id,
    { order_number: order.order_number, item: item.item_name_snapshot, reason }
  );
  commitDb();

  publishRealtimeEvent({
    type: "order.rejected",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `${item.item_name_snapshot} in Order #${order.order_number} unavailable: ${reason}`,
  });

  return order;
}

export function startItemPreparation(itemId: string, actor: SessionPayload): Order {
  const db = getDb();
  if (actor.role !== "chef") {
    throw new Error("Only the Chef can start kitchen food preparation.");
  }
  const order = db.orders.find((o) => o.items.some((i) => i.id === itemId));
  if (!order) throw new Error("Order item not found");
  const item = order.items.find((i) => i.id === itemId)!;

  if (item.status !== "accepted") {
    throw new Error(`Item cannot start preparing from status '${item.status}'.`);
  }

  const nowIso = new Date().toISOString();
  item.status = "preparing";
  item.started_at = nowIso;

  const ticket = db.kitchen_tickets.find((kt) => kt.order_item_id === item.id);
  if (ticket) {
    ticket.status = "preparing";
    ticket.chef_id = actor.userId;
    ticket.updated_at = nowIso;
  }

  recomputeParentOrderStatus(order);
  logOrderStatus(
    db,
    order.id,
    item.id,
    "accepted",
    "preparing",
    { id: actor.userId, role: actor.role },
    null
  );
  commitDb();

  publishRealtimeEvent({
    type: "item.preparing",
    channel: "restaurant:kitchen",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `${item.item_name_snapshot} (Order #${order.order_number}) is now cooking`,
  });

  return order;
}

export function markItemReady(itemId: string, actor: SessionPayload): Order {
  const db = getDb();
  if (actor.role !== "chef") {
    throw new Error("Only the Chef can mark food ready for pickup.");
  }
  const order = db.orders.find((o) => o.items.some((i) => i.id === itemId));
  if (!order) throw new Error("Order item not found");
  const item = order.items.find((i) => i.id === itemId)!;

  if (item.status !== "accepted" && item.status !== "preparing") {
    throw new Error(`Item cannot be marked ready from status '${item.status}'.`);
  }

  const prev = item.status;
  const nowIso = new Date().toISOString();
  item.status = "ready";
  if (!item.started_at) item.started_at = nowIso;
  item.ready_at = nowIso;

  const ticket = db.kitchen_tickets.find((kt) => kt.order_item_id === item.id);
  if (ticket) {
    ticket.status = "ready";
    ticket.updated_at = nowIso;
  }

  recomputeParentOrderStatus(order);
  logOrderStatus(
    db,
    order.id,
    item.id,
    prev,
    "ready",
    { id: actor.userId, role: actor.role },
    null
  );
  commitDb();

  publishRealtimeEvent({
    type: "item.ready",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `READY FOR PICKUP: ${item.quantity}x ${item.item_name_snapshot} → ${order.table_number} (Order #${order.order_number})`,
  });

  return order;
}

// ============================================================================
// STAFF DELIVERY WORKFLOW
// ============================================================================

export function markItemServed(
  itemId: string,
  actor: SessionPayload,
  overrideReason?: string
): Order {
  const db = getDb();
  if (!["staff", "manager", "owner"].includes(actor.role)) {
    throw new Error("Only floor staff (or authorized manager override) can mark items served.");
  }

  const order = db.orders.find((o) => o.items.some((i) => i.id === itemId));
  if (!order) throw new Error("Order item not found");
  const item = order.items.find((i) => i.id === itemId)!;

  if (item.status !== "ready") {
    if (actor.role === "staff") {
      throw new Error("Staff can only mark food as served once the kitchen marks it READY.");
    }
    if (!overrideReason?.trim()) {
      throw new Error("Manager/Owner override requires a reason.");
    }
  }

  const prev = item.status;
  const nowIso = new Date().toISOString();
  item.status = "served";
  item.served_at = nowIso;
  item.served_by = actor.userId;

  const ticket = db.kitchen_tickets.find((kt) => kt.order_item_id === item.id);
  if (ticket) {
    ticket.status = "picked_up";
    ticket.updated_at = nowIso;
  }

  recomputeParentOrderStatus(order);
  logOrderStatus(
    db,
    order.id,
    item.id,
    prev,
    "served",
    { id: actor.userId, role: actor.role },
    overrideReason ?? null
  );

  if (prev !== "ready") {
    addAudit(
      db,
      { id: actor.userId, name: actor.fullName, role: actor.role },
      "ITEM_SERVED_OVERRIDE",
      "order_item",
      item.id,
      { order_number: order.order_number, item: item.item_name_snapshot, reason: overrideReason }
    );
  }

  commitDb();

  publishRealtimeEvent({
    type: "item.served",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `${item.quantity}x ${item.item_name_snapshot} served to ${order.table_number}`,
  });

  return order;
}

export function cancelOrderAuthorized(
  orderId: string,
  reason: string,
  actor: SessionPayload
): Order {
  const db = getDb();
  if (!["manager", "owner"].includes(actor.role)) {
    throw new Error("Only Manager or Owner can authorize order cancellation.");
  }
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Cancellation reason is required.");

  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "completed" || order.status === "cancelled") {
    throw new Error(`Order #${order.order_number} cannot be cancelled.`);
  }

  const prev = order.status;
  order.status = "cancelled";
  order.cancellation_reason = cleanReason;
  order.updated_at = new Date().toISOString();
  for (const item of order.items) {
    if (item.status !== "rejected") item.status = "cancelled";
  }

  logOrderStatus(
    db,
    order.id,
    null,
    prev,
    "cancelled",
    { id: actor.userId, role: actor.role },
    cleanReason
  );
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "ORDER_CANCELLED",
    "order",
    order.id,
    { order_number: order.order_number, table_number: order.table_number, reason: cleanReason }
  );
  commitDb();

  publishRealtimeEvent({
    type: "order.cancelled",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `Order #${order.order_number} (${order.table_number}) cancelled by ${actor.role}: ${cleanReason}`,
  });

  return order;
}

// ============================================================================
// COMBINED TABLE BILLING & DUAL-MODE PAYMENTS (RAZORPAY + COUNTER)
// ============================================================================

export function getSessionBillSummary(sessionId: string): SessionBillSummary {
  const db = getDb();
  const session = db.table_sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session not found");
  const table = db.restaurant_tables.find((t) => t.id === session.table_id);

  const sessionOrders = db.orders.filter((o) => o.session_id === sessionId);
  const billableOrders = sessionOrders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );

  const lineItems: SessionBillSummary["line_items"] = [];
  let subtotal = 0;

  for (const order of billableOrders) {
    for (const item of order.items) {
      if (item.status === "rejected" || item.status === "cancelled") continue;
      subtotal = roundMoney(subtotal + item.item_total);
      lineItems.push({
        order_number: order.order_number,
        item_name: item.item_name_snapshot,
        variant_name: item.variant_name_snapshot,
        addons: item.addons.map((a) => a.addon_name_snapshot),
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_total: item.item_total,
        status: item.status,
      });
    }
  }

  const taxAmount = roundMoney((subtotal * db.settings.tax_rate_percent) / 100);
  const serviceCharge = roundMoney((subtotal * db.settings.service_charge_percent) / 100);
  const grandTotal = roundMoney(subtotal + taxAmount + serviceCharge);

  const payments = db.payments.filter((p) => p.session_id === sessionId);
  const paidGross = roundMoney(
    payments
      .filter((p) => p.status === "paid" || p.status === "refunded")
      .reduce((sum, p) => sum + p.amount, 0)
  );
  const paymentIds = new Set(payments.map((p) => p.id));
  const refundedAmount = roundMoney(
    db.refunds
      .filter((r) => paymentIds.has(r.payment_id) && r.status === "processed")
      .reduce((sum, r) => sum + r.amount, 0)
  );
  const netPaid = roundMoney(Math.max(0, paidGross - refundedAmount));
  const balanceDue = roundMoney(Math.max(0, grandTotal - netPaid));

  let paymentState: SessionBillSummary["payment_state"] = "unpaid";
  if (grandTotal > 0 && balanceDue <= 0.01) paymentState = "paid";
  else if (netPaid > 0) paymentState = "partially_paid";

  return {
    session_id: session.id,
    table_id: session.table_id,
    table_number: table?.table_number ?? "Table",
    session_status: session.status,
    bill_requested_at: session.bill_requested_at,
    opened_at: session.opened_at,
    orders: sessionOrders,
    line_items: lineItems,
    subtotal,
    tax_rate_percent: db.settings.tax_rate_percent,
    tax_amount: taxAmount,
    service_charge_percent: db.settings.service_charge_percent,
    service_charge: serviceCharge,
    grand_total: grandTotal,
    amount_paid: netPaid,
    refunded_amount: refundedAmount,
    balance_due: balanceDue,
    payment_state: paymentState,
    payments,
  };
}

export function requestSessionBill(sessionId: string, preferredMethod: "online" | "counter" = "counter") {
  const db = getDb();
  const session = db.table_sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status === "closed") throw new Error("Session is already closed.");

  const table = db.restaurant_tables.find((t) => t.id === session.table_id);
  const bill = getSessionBillSummary(sessionId);
  if (bill.grand_total <= 0) {
    throw new Error("No billable orders in this session yet.");
  }

  session.status = "payment_pending";
  session.bill_requested_at = new Date().toISOString();
  commitDb();

  publishRealtimeEvent({
    type: "bill.requested",
    channel: "restaurant:payments",
    session_id: session.id,
    table_number: table?.table_number,
    message: `${table?.table_number} requested final bill (${preferredMethod === "counter" ? "Pay at Counter" : "Online"}) — Balance ₹${bill.balance_due.toFixed(2)}`,
  });

  return getSessionBillSummary(sessionId);
}

export function initiateOnlinePayment(
  sessionId: string,
  amountInput: number | undefined,
  channel: "upi" | "card",
  idempotencyKey?: string
) {
  const db = getDb();
  const bill = getSessionBillSummary(sessionId);
  if (bill.session_status === "closed") throw new Error("Session is already closed.");
  if (bill.balance_due <= 0.01) throw new Error("Bill is already fully paid.");

  if (idempotencyKey) {
    const existing = db.payments.find((p) => p.idempotency_key === idempotencyKey);
    if (existing) {
      const tx = db.payment_transactions.find((t) => t.payment_id === existing.id);
      return { payment: existing, transaction: tx! };
    }
  }

  // Mark any earlier abandoned processing attempt for this session as failed so no orphaned PROCESSING rows accumulate
  for (const p of db.payments) {
    if (p.session_id === sessionId && p.status === "processing") {
      p.status = "failed";
    }
  }

  const amount = roundMoney(
    amountInput && amountInput > 0 ? Math.min(amountInput, bill.balance_due) : bill.balance_due
  );

  const nowIso = new Date().toISOString();
  const paymentId = crypto.randomUUID();
  const gatewayOrderId = `order_KORA${crypto.randomBytes(5).toString("hex")}`;
  const receiptNumber = `KORA-${new Date().getFullYear()}-${db.next_receipt_seq++}`;

  const payment: Payment = {
    id: paymentId,
    session_id: sessionId,
    table_number: bill.table_number,
    amount,
    method: "online",
    channel,
    status: "processing",
    receipt_number: receiptNumber,
    collected_by: null,
    collected_by_name: channel === "upi" ? "Demo Online (UPI)" : "Demo Online (Card)",
    idempotency_key: idempotencyKey ?? crypto.randomUUID(),
    paid_at: null,
    created_at: nowIso,
  };

  const transaction = {
    id: crypto.randomUUID(),
    payment_id: paymentId,
    gateway: "razorpay" as const,
    gateway_order_id: gatewayOrderId,
    gateway_payment_id: null,
    gateway_signature: null,
    gateway_event_id: null,
    signature_verified: false,
    created_at: nowIso,
  };

  db.payments.unshift(payment);
  db.payment_transactions.unshift(transaction);
  commitDb();

  return { payment, transaction };
}

export function verifyAndCompleteOnlinePayment(params: {
  paymentId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
  simulateFail?: boolean;
}) {
  const db = getDb();
  const payment = db.payments.find((p) => p.id === params.paymentId);
  if (!payment) throw new Error("Payment record not found");

  // Idempotency: ignore duplicate gateway confirmation if already paid
  if (payment.status === "paid") {
    return { payment, bill: getSessionBillSummary(payment.session_id), duplicate: true };
  }

  const tx = db.payment_transactions.find(
    (t) => t.payment_id === payment.id && t.gateway_order_id === params.gatewayOrderId
  );
  if (!tx) throw new Error("Payment transaction mismatch.");

  if (params.simulateFail) {
    payment.status = "failed";
    commitDb();
    return { payment, bill: getSessionBillSummary(payment.session_id), duplicate: false };
  }

  const valid = verifyRazorpaySignature(
    params.gatewayOrderId,
    params.gatewayPaymentId,
    params.gatewaySignature
  );
  if (!valid) {
    payment.status = "failed";
    commitDb();
    throw new Error("Razorpay payment signature verification failed on server.");
  }

  payment.status = "paid";
  payment.paid_at = new Date().toISOString();
  tx.gateway_payment_id = params.gatewayPaymentId;
  tx.gateway_signature = params.gatewaySignature;
  tx.signature_verified = true;

  // Expire any other unfinished processing attempts on the same session
  for (const other of db.payments) {
    if (other.session_id === payment.session_id && other.id !== payment.id && other.status === "processing") {
      other.status = "failed";
    }
  }

  addAudit(
    db,
    { id: null, name: "Demo Payment Simulator", role: "system" },
    "ONLINE_PAYMENT_VERIFIED",
    "payment",
    payment.id,
    {
      table_number: payment.table_number,
      amount: payment.amount,
      gateway_payment_id: params.gatewayPaymentId,
      receipt: payment.receipt_number,
    }
  );
  commitDb();

  let bill = getSessionBillSummary(payment.session_id);
  publishRealtimeEvent({
    type: "payment.completed",
    channel: "restaurant:payments",
    session_id: payment.session_id,
    table_number: payment.table_number,
    message: `Online payment of ₹${payment.amount.toFixed(2)} verified for ${payment.table_number} (${payment.receipt_number})`,
  });

  if (bill.balance_due <= 0.01) {
    closeTableSession(payment.session_id, {
      id: null,
      name: "Automated Billing Engine",
      role: "system",
    });
    bill = getSessionBillSummary(payment.session_id);
  }

  return { payment, bill, duplicate: false };
}

export function recordCounterPayment(
  sessionId: string,
  amountInput: number,
  channel: PaymentChannel,
  actor: SessionPayload
) {
  const db = getDb();
  if (!["staff", "manager", "owner"].includes(actor.role)) {
    throw new Error("Chefs cannot access or confirm payments.");
  }

  const bill = getSessionBillSummary(sessionId);
  if (bill.session_status === "closed") throw new Error("Session is already closed.");
  if (bill.balance_due <= 0.01) throw new Error("Session has no remaining balance due.");

  const amount = roundMoney(Math.min(Math.max(0.01, amountInput), bill.balance_due));
  const nowIso = new Date().toISOString();
  const payment: Payment = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    table_number: bill.table_number,
    amount,
    method: "counter",
    channel,
    status: "paid",
    receipt_number: `KORA-${new Date().getFullYear()}-${db.next_receipt_seq++}`,
    collected_by: actor.userId,
    collected_by_name: actor.fullName,
    idempotency_key: crypto.randomUUID(),
    paid_at: nowIso,
    created_at: nowIso,
  };

  db.payments.unshift(payment);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "COUNTER_PAYMENT_CONFIRMED",
    "payment",
    payment.id,
    {
      table_number: bill.table_number,
      amount,
      channel,
      receipt: payment.receipt_number,
    }
  );
  commitDb();

  let updatedBill = getSessionBillSummary(sessionId);
  publishRealtimeEvent({
    type: "payment.completed",
    channel: "restaurant:payments",
    session_id: sessionId,
    table_number: bill.table_number,
    message: `Counter payment ₹${amount.toFixed(2)} (${channel.toUpperCase()}) collected for ${bill.table_number} by ${actor.fullName}`,
  });

  if (updatedBill.balance_due <= 0.01) {
    closeTableSession(sessionId, {
      id: actor.userId,
      name: actor.fullName,
      role: actor.role,
    });
    updatedBill = getSessionBillSummary(sessionId);
  }

  return { payment, bill: updatedBill };
}

export function issuePaymentRefund(
  paymentId: string,
  amountInput: number,
  reason: string,
  actor: SessionPayload
) {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can authorize refunds.");
  }
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Refund reason is mandatory.");

  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "paid") throw new Error("Only paid transactions can be refunded.");

  const alreadyRefunded = db.refunds
    .filter((r) => r.payment_id === payment.id && r.status === "processed")
    .reduce((sum, r) => sum + r.amount, 0);
  const maxRefundable = roundMoney(payment.amount - alreadyRefunded);
  if (maxRefundable <= 0) throw new Error("Payment is already fully refunded.");

  const amount = roundMoney(Math.min(Math.max(0.01, amountInput), maxRefundable));
  const refund = {
    id: crypto.randomUUID(),
    payment_id: payment.id,
    amount,
    reason: cleanReason,
    status: "processed" as const,
    authorized_by: actor.userId,
    authorized_by_name: actor.fullName,
    created_at: new Date().toISOString(),
  };

  db.refunds.unshift(refund);
  if (roundMoney(alreadyRefunded + amount) >= payment.amount) {
    payment.status = "refunded";
  }

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "PAYMENT_REFUNDED",
    "refund",
    refund.id,
    {
      payment_id: payment.id,
      receipt: payment.receipt_number,
      amount,
      reason: cleanReason,
    }
  );
  commitDb();

  publishRealtimeEvent({
    type: "payment.refunded",
    channel: "restaurant:payments",
    session_id: payment.session_id,
    table_number: payment.table_number,
    message: `Refund of ₹${amount.toFixed(2)} issued for ${payment.receipt_number}`,
  });

  return refund;
}

// ============================================================================
// MANAGEMENT CRUD (MENU, TABLES, STAFF, INVENTORY, EXPENSES, SETTINGS)
// ============================================================================

export function toggleMenuItemAvailability(
  itemId: string,
  isAvailable: boolean,
  actor: SessionPayload
): MenuItem {
  const db = getDb();
  if (!["owner", "manager", "chef"].includes(actor.role)) {
    throw new Error("Unauthorized to toggle item availability.");
  }
  const item = db.menu_items.find((m) => m.id === itemId && !m.deleted_at);
  if (!item) throw new Error("Menu item not found");

  item.is_available = isAvailable;
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "MENU_ITEM_AVAILABILITY_CHANGED",
    "menu_item",
    item.id,
    { item: item.name, is_available: isAvailable }
  );
  commitDb();

  publishRealtimeEvent({
    type: "menu.updated",
    channel: "restaurant:orders",
    message: `${item.name} marked ${isAvailable ? "AVAILABLE" : "OUT OF STOCK"} by ${actor.fullName}`,
  });

  return item;
}

export function updateMenuItemStock(
  itemId: string,
  input: { stock_count?: number; delta?: number },
  actor: SessionPayload
): MenuItem {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can update dish stock counts.");
  }
  const item = db.menu_items.find((m) => m.id === itemId && !m.deleted_at);
  if (!item) throw new Error("Menu item not found");

  const prevCount = item.stock_count ?? 0;
  const nextCount =
    typeof input.stock_count === "number"
      ? Math.max(0, Math.floor(input.stock_count))
      : Math.max(0, Math.floor(prevCount + (input.delta ?? 0)));

  item.stock_count = nextCount;
  if (nextCount === 0) {
    item.is_available = false;
  } else if (nextCount > 0 && !item.is_available) {
    item.is_available = true;
  }

  for (const flag of db.low_stock_flags) {
    if (flag.menu_item_id === item.id && flag.status === "open") {
      flag.current_stock_count = nextCount;
    }
  }

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "MENU_ITEM_STOCK_UPDATED",
    "menu_item",
    item.id,
    { item: item.name, previous_stock: prevCount, new_stock: nextCount, is_available: item.is_available }
  );
  commitDb();

  publishRealtimeEvent({
    type: "menu.updated",
    channel: "restaurant:orders",
    message: `${item.name} stock updated to ${nextCount} (${item.is_available ? "Available" : "Sold Out"})`,
  });

  return item;
}

export function flagDishLowStock(
  menuItemId: string,
  note: string,
  actor: SessionPayload
): LowStockFlag {
  const db = getDb();
  if (actor.role !== "chef") {
    throw new Error("Only the Chef can submit kitchen low-stock flags.");
  }
  const item = db.menu_items.find((m) => m.id === menuItemId && !m.deleted_at);
  if (!item) throw new Error("Menu item not found");

  const cleanNote = note.trim() || "Running low on kitchen line";
  const flag: LowStockFlag = {
    id: crypto.randomUUID(),
    menu_item_id: item.id,
    menu_item_name: item.name,
    current_stock_count: item.stock_count ?? 0,
    note: cleanNote,
    flagged_by_id: actor.userId,
    flagged_by_name: actor.fullName,
    status: "open",
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by_name: null,
  };

  db.low_stock_flags.unshift(flag);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "DISH_LOW_STOCK_FLAGGED",
    "menu_item",
    item.id,
    { item: item.name, stock_count: flag.current_stock_count, note: cleanNote }
  );
  commitDb();

  publishRealtimeEvent({
    type: "inventory.updated",
    channel: "restaurant:orders",
    message: `Chef flagged low stock: ${item.name} (${cleanNote})`,
  });

  return flag;
}

export function resolveLowStockFlag(
  flagId: string,
  actor: SessionPayload
): LowStockFlag {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can resolve low-stock flags.");
  }
  const flag = db.low_stock_flags.find((f) => f.id === flagId);
  if (!flag) throw new Error("Low-stock flag not found");

  flag.status = "resolved";
  flag.resolved_at = new Date().toISOString();
  flag.resolved_by_name = actor.fullName;

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "DISH_LOW_STOCK_FLAG_RESOLVED",
    "low_stock_flag",
    flag.id,
    { item: flag.menu_item_name }
  );
  commitDb();

  publishRealtimeEvent({
    type: "inventory.updated",
    channel: "restaurant:orders",
    message: `Low-stock flag resolved for ${flag.menu_item_name}`,
  });

  return flag;
}

export function createMenuItem(
  data: Omit<MenuItem, "id" | "deleted_at" | "variants" | "addons" | "stock_count"> & {
    stock_count?: number;
    variants?: Array<{ name: string; price_delta: number; is_default?: boolean }>;
    addons?: Array<{ name: string; price: number }>;
  },
  actor: SessionPayload
): MenuItem {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can create menu items.");
  }
  const cleanName = data.name.trim();
  const existing = db.menu_items.find(
    (m) => !m.deleted_at && m.name.trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    throw new Error(`A dish named "${cleanName}" already exists on the menu.`);
  }
  const id = crypto.randomUUID();
  const initialStock =
    typeof data.stock_count === "number"
      ? Math.max(0, Math.floor(data.stock_count))
      : data.is_available
      ? 20
      : 0;
  const item: MenuItem = {
    ...data,
    id,
    stock_count: initialStock,
    is_available: initialStock > 0 ? data.is_available : false,
    deleted_at: null,
    variants: (data.variants ?? []).map((v, idx) => ({
      id: crypto.randomUUID(),
      menu_item_id: id,
      name: v.name,
      price_delta: v.price_delta,
      is_default: v.is_default ?? idx === 0,
    })),
    addons: (data.addons ?? []).map((a) => ({
      id: crypto.randomUUID(),
      name: a.name,
      price: a.price,
    })),
  };
  db.menu_items.push(item);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "MENU_ITEM_CREATED",
    "menu_item",
    item.id,
    { name: item.name, price: item.price }
  );
  commitDb();
  publishRealtimeEvent({
    type: "menu.updated",
    channel: "restaurant:orders",
    message: `New dish added to menu: ${item.name}`,
  });
  return item;
}

export function updateMenuItem(
  itemId: string,
  patch: Partial<Pick<MenuItem, "name" | "description" | "price" | "category_id" | "dietary" | "spice_level" | "prep_minutes" | "is_bestseller" | "is_available" | "image_url">>,
  actor: SessionPayload
): MenuItem {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can edit menu items.");
  }
  const item = db.menu_items.find((m) => m.id === itemId && !m.deleted_at);
  if (!item) throw new Error("Menu item not found");

  if (patch.name !== undefined) {
    const cleanName = patch.name.trim();
    if (!cleanName) throw new Error("Dish name cannot be empty.");
    const existing = db.menu_items.find(
      (m) => m.id !== itemId && !m.deleted_at && m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      throw new Error(`A dish named "${cleanName}" already exists on the menu.`);
    }
    patch.name = cleanName;
  }

  // Only owner can change prices if strict control desired; both allowed per matrix
  Object.assign(item, patch);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "MENU_ITEM_UPDATED",
    "menu_item",
    item.id,
    { name: item.name, changes: patch }
  );
  commitDb();
  publishRealtimeEvent({
    type: "menu.updated",
    channel: "restaurant:orders",
    message: `Menu updated: ${item.name}`,
  });
  return item;
}

export function softDeleteMenuItem(itemId: string, actor: SessionPayload): void {
  const db = getDb();
  if (actor.role !== "owner") {
    throw new Error("Only Owner can archive menu items.");
  }
  const item = db.menu_items.find((m) => m.id === itemId && !m.deleted_at);
  if (!item) throw new Error("Menu item not found");
  item.deleted_at = new Date().toISOString();
  item.is_available = false;
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "MENU_ITEM_ARCHIVED",
    "menu_item",
    item.id,
    { name: item.name }
  );
  commitDb();
}

export function createCategory(
  name: string,
  description: string,
  actor: SessionPayload
): MenuCategory {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can create categories.");
  }
  const cat: MenuCategory = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    sort_order: db.menu_categories.length + 1,
    is_active: true,
  };
  db.menu_categories.push(cat);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "CATEGORY_CREATED",
    "menu_category",
    cat.id,
    { name: cat.name }
  );
  commitDb();
  return cat;
}

export function createTable(
  tableNumber: string,
  section: string,
  capacity: number,
  actor: SessionPayload
): RestaurantTable {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can create tables.");
  }
  const normalized = tableNumber.trim();
  if (db.restaurant_tables.some((t) => t.table_number.toLowerCase() === normalized.toLowerCase())) {
    throw new Error(`Table "${normalized}" already exists.`);
  }
  const table: RestaurantTable = {
    id: crypto.randomUUID(),
    table_number: normalized,
    section: section.trim() || "Main Dining",
    qr_token: crypto.randomUUID(),
    capacity: Math.max(1, capacity || 4),
    status: "available",
    is_active: true,
    created_at: new Date().toISOString(),
  };
  db.restaurant_tables.push(table);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "TABLE_CREATED",
    "restaurant_table",
    table.id,
    { table_number: table.table_number, section: table.section }
  );
  commitDb();
  publishRealtimeEvent({
    type: "table.updated",
    channel: "restaurant:tables",
    table_number: table.table_number,
    message: `New table added: ${table.table_number}`,
  });
  return table;
}

export function assignStaffToTable(
  tableId: string,
  staffId: string,
  actor: SessionPayload
) {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can assign staff to tables.");
  }
  const table = db.restaurant_tables.find((t) => t.id === tableId);
  const staff = db.users.find((u) => u.id === staffId && u.role === "staff" && u.is_active);
  if (!table || !staff) throw new Error("Invalid table or staff member.");

  for (const ta of db.table_assignments) {
    if (ta.table_id === tableId && ta.is_active) {
      ta.is_active = false;
    }
  }
  const assignment = {
    id: crypto.randomUUID(),
    table_id: tableId,
    staff_id: staffId,
    assigned_by: actor.userId,
    is_active: true,
    assigned_at: new Date().toISOString(),
  };
  db.table_assignments.push(assignment);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "TABLE_STAFF_ASSIGNED",
    "table_assignment",
    assignment.id,
    { table_number: table.table_number, staff_name: staff.full_name }
  );
  commitDb();
  publishRealtimeEvent({
    type: "table.updated",
    channel: "restaurant:tables",
    table_number: table.table_number,
    message: `${staff.full_name} assigned to ${table.table_number}`,
  });
  return assignment;
}

export function createEmployee(
  data: { full_name: string; email: string; role: UserRole; phone?: string; id?: string },
  actor: SessionPayload
): User {
  const db = getDb();
  if (actor.role === "manager" && !["staff", "chef"].includes(data.role)) {
    throw new Error("Managers can only create Staff and Chef accounts. Only Owner can create Managers.");
  }
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Unauthorized to create employees.");
  }
  const email = data.email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("An account with this user ID already exists.");
  }

  const user: User = {
    id: data.id ?? crypto.randomUUID(),
    full_name: data.full_name.trim(),
    email,
    role: data.role,
    phone: data.phone?.trim(),
    is_active: true,
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "EMPLOYEE_CREATED",
    "user",
    user.id,
    { full_name: user.full_name, role: user.role, email: user.email }
  );
  commitDb();
  return user;
}

export function toggleEmployeeActive(userId: string, isActive: boolean, actor: SessionPayload): User {
  const db = getDb();
  const target = db.users.find((u) => u.id === userId);
  if (!target) throw new Error("Employee not found");
  if (actor.role === "manager" && !["staff", "chef"].includes(target.role)) {
    throw new Error("Managers cannot modify Owner or Manager accounts.");
  }
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("Unauthorized");
  }
  if (target.id === actor.userId) {
    throw new Error("You cannot disable your own account.");
  }
  target.is_active = isActive;
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    isActive ? "EMPLOYEE_ENABLED" : "EMPLOYEE_DISABLED",
    "user",
    target.id,
    { full_name: target.full_name, role: target.role }
  );
  commitDb();
  return target;
}

export function deleteEmployee(userId: string, actor: SessionPayload): User {
  const db = getDb();
  const index = db.users.findIndex((u) => u.id === userId);
  if (index === -1) throw new Error("Employee not found");
  const target = db.users[index];

  if (actor.role !== "owner") {
    throw new Error("Only the restaurant owner can permanently delete employee accounts.");
  }
  if (target.id === actor.userId) {
    throw new Error("You cannot delete your own account.");
  }

  // Remove table assignments for this staff member
  db.table_assignments = db.table_assignments.filter((a) => a.staff_id !== userId);

  // Remove from users array
  db.users.splice(index, 1);

  // Remove local cached password if present
  if (globalThis.__koraLocalPasswords) {
    delete globalThis.__koraLocalPasswords[target.email.toLowerCase()];
  }

  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "EMPLOYEE_DELETED",
    "user",
    target.id,
    { full_name: target.full_name, role: target.role, email: target.email }
  );

  commitDb();
  return target;
}

export function adjustInventory(
  itemId: string,
  movementType: "restock" | "deduction" | "wastage" | "adjustment",
  quantity: number,
  note: string,
  actor: SessionPayload
) {
  const db = getDb();
  if (!["owner", "manager"].includes(actor.role)) {
    throw new Error("Only Owner or Manager can modify inventory.");
  }
  const item = db.inventory_items.find((i) => i.id === itemId);
  if (!item) throw new Error("Inventory item not found");

  const delta =
    movementType === "deduction" || movementType === "wastage"
      ? -Math.abs(quantity)
      : movementType === "restock"
      ? Math.abs(quantity)
      : quantity;

  item.current_stock = roundMoney(Math.max(0, item.current_stock + delta));
  item.updated_at = new Date().toISOString();

  db.inventory_movements.unshift({
    id: crypto.randomUUID(),
    inventory_item_id: item.id,
    inventory_item_name: item.name,
    movement_type: movementType,
    quantity_delta: delta,
    note: note.trim() || movementType,
    actor_id: actor.userId,
    actor_name: actor.fullName,
    created_at: new Date().toISOString(),
  });
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "INVENTORY_ADJUSTED",
    "inventory_item",
    item.id,
    { item: item.name, movement_type: movementType, delta, new_stock: item.current_stock }
  );
  commitDb();
  publishRealtimeEvent({
    type: "inventory.updated",
    channel: "restaurant:orders",
    message: `Inventory updated: ${item.name} (${item.current_stock} ${item.unit})`,
  });
  return item;
}

export function recordExpense(
  data: { title: string; category: "ingredients" | "utilities" | "staff" | "maintenance" | "marketing" | "other"; amount: number },
  actor: SessionPayload
) {
  const db = getDb();
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("Unauthorized");
  }
  const expense = {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    category: data.category,
    amount: roundMoney(data.amount),
    expense_date: new Date().toISOString().slice(0, 10),
    recorded_by: actor.fullName,
    created_at: new Date().toISOString(),
  };
  db.expenses.unshift(expense);
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "EXPENSE_RECORDED",
    "expense",
    expense.id,
    { title: expense.title, amount: expense.amount }
  );
  commitDb();
  return expense;
}

export function updateRestaurantSettings(
  patch: Partial<RestaurantSettings>,
  actor: SessionPayload
): RestaurantSettings {
  const db = getDb();
  if (actor.role !== "owner") {
    throw new Error("Only the Owner can modify restaurant tax & system settings.");
  }
  db.settings = {
    ...db.settings,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  addAudit(
    db,
    { id: actor.userId, name: actor.fullName, role: actor.role },
    "SETTINGS_UPDATED",
    "restaurant_settings",
    "1",
    { changes: patch }
  );
  commitDb();
  return db.settings;
}


export function cancelOrderItemByCustomer(
  orderId: string,
  itemId: string,
  reason: string
): { order: Order; item: OrderItem; bill: SessionBillSummary } {
  const db = getDb();
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("A cancellation reason is mandatory.");

  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found");

  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Order item not found");

  if (item.status === "cancelled") {
    throw new Error("This item is already cancelled.");
  }

  // Items already Accepted or Cooking can no longer be cancelled by the customer
  if (item.status !== "pending_approval") {
    throw new Error(
      `Item "${item.item_name_snapshot}" cannot be cancelled because preparation has already started (${item.status}).`
    );
  }

  const nowIso = new Date().toISOString();
  const prevStatus = item.status;
  item.status = "cancelled";
  item.cancellation_reason = cleanReason;
  item.cancelled_at = nowIso;

  // Invalidate any matching kitchen ticket
  const ticket = db.kitchen_tickets.find((k) => k.order_item_id === itemId);
  if (ticket) {
    ticket.status = "cancelled";
    ticket.updated_at = nowIso;
  }

  // If ALL active items in this order are now cancelled or rejected, cancel entire order
  const activeItems = order.items.filter(
    (i) => i.status !== "cancelled" && i.status !== "rejected"
  );
  if (activeItems.length === 0) {
    order.status = "cancelled";
    order.cancellation_reason = cleanReason;
    order.updated_at = nowIso;
  }

  logOrderStatus(
    db,
    order.id,
    item.id,
    prevStatus,
    "cancelled",
    { id: null, role: "customer" },
    cleanReason
  );

  addAudit(
    db,
    { id: null, name: `Customer (Table ${order.table_number})`, role: "customer" },
    "ORDER_ITEM_CANCELLED",
    "order_item",
    item.id,
    {
      order_id: order.id,
      order_number: order.order_number,
      table_number: order.table_number,
      item_name: item.item_name_snapshot,
      reason: cleanReason,
    }
  );

  commitDb();

  publishRealtimeEvent({
    type: "order.cancelled",
    channel: "restaurant:orders",
    session_id: order.session_id,
    table_number: order.table_number,
    order_number: order.order_number,
    message: `${item.item_name_snapshot} cancelled by customer at Table ${order.table_number}`,
  });

  const bill = getSessionBillSummary(order.session_id);
  return { order, item, bill };
}
