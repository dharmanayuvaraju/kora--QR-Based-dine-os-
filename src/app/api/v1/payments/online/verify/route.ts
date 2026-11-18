import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAndCompleteOnlinePayment } from "@/lib/db/store";

const Schema = z.object({
  payment_id: z.string().min(1),
  gateway_order_id: z.string().min(1),
  gateway_payment_id: z.string().min(1),
  gateway_signature: z.string().min(1),
  simulate_fail: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = Schema.parse(await req.json());
    const result = verifyAndCompleteOnlinePayment({
      paymentId: body.payment_id,
      gatewayOrderId: body.gateway_order_id,
      gatewayPaymentId: body.gateway_payment_id,
      gatewaySignature: body.gateway_signature,
      simulateFail: body.simulate_fail,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment verification failed" },
      { status: 400 }
    );
  }
}
