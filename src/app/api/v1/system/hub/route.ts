import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import {
  isSupabaseConfigured,
  isSupabaseServerPersistenceConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
    const db = getDb();
    const session = await getAuthenticatedSession();
    const currentUser = session
      ? db.users.find((u) => u.id === session.userId && u.is_active) ?? null
      : null;

    // Never expose secret table QR tokens publicly; only signed-in staff can see them
    const tables = currentUser
      ? db.restaurant_tables.map((t) => {
          const activeSession = db.table_sessions.find(
            (s) => s.table_id === t.id && s.status !== "closed"
          );
          const activeOrders = activeSession
            ? db.orders.filter(
                (o) =>
                  o.session_id === activeSession.id &&
                  !["rejected", "cancelled"].includes(o.status)
              )
            : [];
          return {
            id: t.id,
            table_number: t.table_number,
            section: t.section,
            capacity: t.capacity,
            qr_token: t.qr_token,
            status: t.status,
            session_status: activeSession?.status ?? null,
            order_count: activeOrders.length,
          };
        })
      : [];

    const pendingKitchen = db.orders.filter(
      (o) => o.status === "pending_approval"
    ).length;
    const readyItems = db.orders.reduce(
      (count, o) => count + o.items.filter((i) => i.status === "ready").length,
      0
    );
    const billRequests = db.table_sessions.filter(
      (s) => s.status === "payment_pending"
    ).length;
    const activeSessions = db.table_sessions.filter(
      (s) => s.status !== "closed"
    ).length;

    return NextResponse.json(
      {
        restaurant: db.settings,
        mode: isSupabaseConfigured() ? "supabase" : "dual-mode-local",
        storage_mode: isSupabaseServerPersistenceConfigured()
          ? "supabase-postgres"
          : "local-ephemeral",
        authenticated: Boolean(currentUser),
        current_role: currentUser?.role ?? null,
        stats: {
          active_sessions: activeSessions,
          pending_kitchen: pendingKitchen,
          ready_items: readyItems,
          bill_requests: billRequests,
          total_tables: db.restaurant_tables.length,
        },
        tables,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    await flushDb();
  }
}
