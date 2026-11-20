import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import { publishRealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const Schema = z.object({
  reason: z.string().optional(),
  session_id: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const { id } = await context.params;
    const body = Schema.parse(await req.json().catch(() => ({})));
    const session = await getAuthenticatedSession();
    const db = getDb();
    const order = db.orders.find((o) => o.id === id);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "completed" || order.status === "cancelled") {
      return NextResponse.json(
        { error: `Order #${order.order_number} is already ${order.status}.` },
        { status: 400 }
      );
    }

    // Role check
    let cancelledBy = "Customer";
    let cancellationReason = body.reason?.trim() || "Cancelled by customer";

    if (session) {
      // Authenticated staff, manager, or owner: mandatory reason
      if (!["owner", "manager", "staff"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
      }
      if (!body.reason?.trim()) {
        return NextResponse.json(
          { error: "Cancellation reason is required." },
          { status: 400 }
        );
      }
      cancelledBy = `${session.fullName} (${session.role.toUpperCase()})`;
      cancellationReason = body.reason.trim();
    } else {
      // Customer path:
      // Verify session match
      if (body.session_id && order.session_id !== body.session_id) {
        return NextResponse.json(
          { error: "This order does not belong to your active table session." },
          { status: 403 }
        );
      }
      cancellationReason = body.reason?.trim() || "Cancelled by customer";

      // Customer can ONLY cancel while Placed or Accepted (not once cooking starts)
      const allowedCustomerStatuses = ["pending_approval", "accepted"];
      if (!allowedCustomerStatuses.includes(order.status)) {
        return NextResponse.json(
          {
            error:
              "Cannot cancel order: preparation has already started in the kitchen. Please speak to your server.",
          },
          { status: 400 }
        );
      }
    }

    const prevStatus = order.status;
    order.status = "cancelled";
    order.cancellation_reason = cancellationReason;
    order.updated_at = new Date().toISOString();

    for (const item of order.items) {
      if (item.status !== "rejected") {
        item.status = "cancelled";
      }
    }

    // Update kitchen ticket
    const ticket = db.kitchen_tickets.find((t) => t.order_id === order.id);
    if (ticket) {
      ticket.status = "cancelled";
      ticket.updated_at = new Date().toISOString();
    }

    // Add status log
    db.order_status_logs.unshift({
      id: crypto.randomUUID(),
      order_id: order.id,
      order_item_id: null,
      from_status: prevStatus,
      to_status: "cancelled",
      actor_id: session?.userId ?? null,
      actor_role: session?.role ?? "customer",
      reason: cancellationReason,
      created_at: new Date().toISOString(),
    });

    // Add audit log
    db.audit_logs.unshift({
      id: crypto.randomUUID(),
      actor_id: session?.userId ?? null,
      actor_name: session?.fullName ?? "Customer",
      actor_role: session?.role ?? "customer",
      action: "ORDER_CANCELLED",
      entity_type: "order",
      entity_id: order.id,
      metadata: {
        order_number: order.order_number,
        table_number: order.table_number,
        cancelled_by: cancelledBy,
        reason: cancellationReason,
      },
      created_at: new Date().toISOString(),
    });

    publishRealtimeEvent({
      type: "order.cancelled",
      channel: "restaurant:orders",
      session_id: order.session_id,
      table_number: order.table_number,
      order_number: order.order_number,
      message: `Order #${order.order_number} for ${order.table_number} was cancelled (${cancellationReason})`,
    });

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel order." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
