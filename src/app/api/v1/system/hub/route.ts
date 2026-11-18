import { NextResponse } from "next/server";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  await ensureDbReady();
  try {
  const db = getDb();
  const tables = db.restaurant_tables.map((t) => {
    const session = db.table_sessions.find(
      (s) => s.table_id === t.id && s.status !== "closed"
    );
    const activeOrders = session
      ? db.orders.filter(
          (o) => o.session_id === session.id && !["rejected", "cancelled"].includes(o.status)
        )
      : [];
    return {
      id: t.id,
      table_number: t.table_number,
      section: t.section,
      capacity: t.capacity,
      qr_token: t.qr_token,
      status: t.status,
      session_status: session?.status ?? null,
      order_count: activeOrders.length,
    };
  });

  const pendingKitchen = db.orders.filter((o) => o.status === "pending_approval").length;
  const readyItems = db.orders.reduce(
    (count, o) =>
      count + o.items.filter((i) => i.status === "ready").length,
    0
  );
  const billRequests = db.table_sessions.filter(
    (s) => s.status === "payment_pending"
  ).length;
  const activeSessions = db.table_sessions.filter((s) => s.status !== "closed").length;

  return NextResponse.json({
    restaurant: db.settings,
    mode: isSupabaseConfigured() ? "supabase" : "dual-mode-local",
    stats: {
      active_sessions: activeSessions,
      pending_kitchen: pendingKitchen,
      ready_items: readyItems,
      bill_requests: billRequests,
      total_tables: db.restaurant_tables.length,
    },
    tables,
  });
  } finally {
    await flushDb();
  }
}
