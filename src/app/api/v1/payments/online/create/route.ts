import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { initiateOnlinePayment, ensureDbReady, flushDb } from "@/lib/db/store";
import { computeRazorpaySignature } from "@/lib/auth";

const Schema = z.object({
  session_id: z.string().min(1),
  amount: z.number().positive().optional(),
  channel: z.enum(["upi", "card"]).default("upi"),
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
  try {
    const body = Schema.parse(await req.json());
    const result = initiateOnlinePayment(
      body.session_id,
      body.amount,
      body.channel,
      body.idempotency_key
    );

    // In local/sandbox demo mode (when live Razorpay secret is not configured),
    // generate a signed demo payment challenge that the checkout modal submits
    // to /payments/online/verify so real HMAC-SHA256 verification executes end-to-end.
    const isLiveRazorpay = Boolean(
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    );
    const demoPaymentId = `pay_KORA${crypto.randomBytes(5).toString("hex")}`;
    const demoSignature = !isLiveRazorpay
      ? computeRazorpaySignature(result.transaction.gateway_order_id, demoPaymentId)
      : undefined;

    return NextResponse.json({
      payment: result.payment,
      gateway_order_id: result.transaction.gateway_order_id,
      razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_kora_demo",
      mode: isLiveRazorpay ? "live" : "sandbox",
      sandbox_challenge: demoSignature
        ? { gateway_payment_id: demoPaymentId, gateway_signature: demoSignature }
        : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize payment" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
