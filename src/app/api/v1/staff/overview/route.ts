import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb, getSessionBillSummary, ensureDbReady, flushDb } from "@/lib/db/store";

export async function GET() {
  await ensureDbReady();
  try {
  const auth = await requireRole(["staff", "manager", "owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  const myAssignedTableIds = new Set(
    db.table_assignments
      .filter((a) => a.is_active && a.staff_id === auth.session.userId)
      .map((a) => a.table_id)
  );

  // Ready items across all active orders (flagged with whether assigned to this waiter)
  const ready_items = db.orders
    .filter((o) => !["rejected", "cancelled", "completed"].includes(o.status))
    .flatMap((order) =>
      order.items
        .filter((item) => item.status === "ready")
        .map((item) => ({
          item,
          order_id: order.id,
          order_number: order.order_number,
          table_id: order.table_id,
          table_number: order.table_number,
          special_instructions: order.special_instructions,
          is_my_table: myAssignedTableIds.has(order.table_id),
        }))
    );

  // Tables with active sessions + live bills
  const tables = db.restaurant_tables.map((table) => {
    const activeSession = db.table_sessions.find(
      (s) =>
        s.table_id === table.id &&
        (s.status === "active" || s.status === "payment_pending")
    );
    const assignment = db.table_assignments.find(
      (a) => a.table_id === table.id && a.is_active
    );
    const assignedStaff = assignment
      ? db.users.find((u) => u.id === assignment.staff_id) ?? null
      : null;
    const bill = activeSession ? getSessionBillSummary(activeSession.id) : null;
    return {
      ...table,
      assigned_staff: assignedStaff
        ? { id: assignedStaff.id, full_name: assignedStaff.full_name }
        : null,
      is_my_table: myAssignedTableIds.has(table.id),
      active_session: activeSession ?? null,
      bill,
    };
  });

  const bill_requests = tables
    .filter((t) => t.active_session && t.active_session.status === "payment_pending" && t.bill)
    .map((t) => ({
      table_number: t.table_number,
      section: t.section,
      is_my_table: t.is_my_table,
      bill: t.bill!,
    }));

  const recently_served = db.orders
    .flatMap((o) =>
      o.items
        .filter((i) => i.status === "served" && i.served_at)
        .map((i) => ({
          id: i.id,
          order_number: o.order_number,
          table_number: o.table_number,
          item_name: i.item_name_snapshot,
          quantity: i.quantity,
          served_at: i.served_at!,
        }))
    )
    .sort((a, b) => b.served_at.localeCompare(a.served_at))
    .slice(0, 20);

  return NextResponse.json({
    staff_name: auth.session.fullName,
    ready_items,
    tables,
    bill_requests,
    recently_served,
    settings: db.settings,
  });
  } finally {
    await flushDb();
  }
}
