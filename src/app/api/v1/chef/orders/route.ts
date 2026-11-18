import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
    const auth = await requireRole(["chef"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

  const db = getDb();
  const pending = db.orders.filter((o) => o.status === "pending_approval");
  const preparing = db.orders.filter(
    (o) => o.status === "accepted" || o.status === "preparing"
  );
  const ready = db.orders.filter((o) => o.status === "ready");
  const rejected = db.orders.filter((o) => o.status === "rejected");
  const history = db.orders.filter(
    (o) => o.status === "served" || o.status === "completed" || o.status === "cancelled"
  );
  const menu_items = db.menu_items.filter((m) => !m.deleted_at);
  const inventory_low = db.inventory_items.filter(
    (i) => i.current_stock <= i.reorder_level
  );

  return NextResponse.json({
    pending,
    preparing,
    ready,
    rejected,
    history,
    menu_items,
    inventory_low,
  });
  } finally {
    await flushDb();
  }
}
