import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb, getSessionBillSummary, recordExpense, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  const isOwner = auth.session.role === "owner";

  const activeOrders = db.orders.filter(
    (o) => !["completed", "rejected", "cancelled"].includes(o.status)
  );
  const validOrders = db.orders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const paidPayments = db.payments.filter(
    (p) => p.status === "paid" || p.status === "refunded"
  );
  const grossCollected = paidPayments.reduce((s, p) => s + p.amount, 0);
  const totalRefunded = db.refunds
    .filter((r) => r.status === "processed")
    .reduce((s, r) => s + r.amount, 0);
  const netCollected = Math.max(0, grossCollected - totalRefunded);
  const onlineRevenue = paidPayments
    .filter((p) => p.method === "online")
    .reduce((s, p) => s + p.amount, 0);
  const counterRevenue = paidPayments
    .filter((p) => p.method === "counter")
    .reduce((s, p) => s + p.amount, 0);
  const totalOrderBookValue = validOrders.reduce((s, o) => s + o.total_amount, 0);
  const totalTaxCollected = validOrders.reduce((s, o) => s + o.tax_amount, 0);
  const totalExpenses = db.expenses.reduce((s, e) => s + e.amount, 0);
  const avgOrderValue =
    validOrders.length > 0 ? totalOrderBookValue / validOrders.length : 0;

  // Dish popularity breakdown
  const dishCounts = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of validOrders) {
    for (const item of order.items) {
      if (item.status === "rejected" || item.status === "cancelled") continue;
      const cur = dishCounts.get(item.item_name_snapshot) ?? {
        name: item.item_name_snapshot,
        qty: 0,
        revenue: 0,
      };
      cur.qty += item.quantity;
      cur.revenue += item.item_total;
      dishCounts.set(item.item_name_snapshot, cur);
    }
  }
  const topDishes = Array.from(dishCounts.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Enriched tables
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
      active_session: activeSession ?? null,
      bill,
    };
  });

  return NextResponse.json({
    role: auth.session.role,
    settings: db.settings,
    kpis: {
      gross_order_value: totalOrderBookValue,
      net_collected: netCollected,
      online_revenue: onlineRevenue,
      counter_revenue: counterRevenue,
      total_tax: totalTaxCollected,
      total_refunded: totalRefunded,
      total_expenses: isOwner ? totalExpenses : null,
      net_profit_est: isOwner ? netCollected - totalExpenses : null,
      avg_order_value: avgOrderValue,
      total_orders: db.orders.length,
      active_orders_count: activeOrders.length,
      pending_approval_count: db.orders.filter((o) => o.status === "pending_approval").length,
      rejected_orders_count: db.orders.filter((o) => o.status === "rejected").length,
      occupied_tables_count: tables.filter((t) => Boolean(t.active_session)).length,
      total_tables_count: tables.length,
      low_stock_count: db.inventory_items.filter(
        (i) => i.current_stock <= i.reorder_level
      ).length,
    },
    top_dishes: topDishes,
    tables,
    orders: db.orders,
    payments: db.payments,
    refunds: db.refunds,
    categories: db.menu_categories,
    menu_items: db.menu_items.filter((m) => !m.deleted_at),
    users: db.users,
    inventory_items: db.inventory_items,
    inventory_movements: db.inventory_movements.slice(0, 30),
    expenses: isOwner ? db.expenses : [],
    audit_logs: db.audit_logs.slice(0, 80),
  });
  } finally {
    await flushDb();
  }
}

const ExpenseSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.enum(["ingredients", "utilities", "staff", "maintenance", "marketing", "other"]),
  amount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = ExpenseSchema.parse(await req.json());
    const expense = recordExpense(body, auth.session);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not record expense" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
