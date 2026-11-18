import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/auth";
import { getDb, verifyAndCompleteOnlinePayment, commitDb } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "Invalid Razorpay webhook signature" },
      { status: 401 }
    );
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
          };
        };
      };
    };
    const eventId = req.headers.get("x-razorpay-event-id") ?? "";
    const db = getDb();

    // Idempotency guard against duplicate webhook delivery
    if (
      eventId &&
      db.payment_transactions.some((tx) => tx.gateway_event_id === eventId)
    ) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    if (payload.event === "payment.captured") {
      const entity = payload.payload?.payment?.entity;
      if (entity?.order_id && entity?.id) {
        const tx = db.payment_transactions.find(
          (t) => t.gateway_order_id === entity.order_id
        );
        if (tx) {
          tx.gateway_event_id = eventId || `evt_${entity.id}`;
          commitDb();
          verifyAndCompleteOnlinePayment({
            paymentId: tx.payment_id,
            gatewayOrderId: entity.order_id,
            gatewayPaymentId: entity.id,
            gatewaySignature: signature,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing error" },
      { status: 400 }
    );
  }
}
