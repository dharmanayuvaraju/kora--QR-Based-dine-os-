import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { recordCounterPayment } from "@/lib/db/store";

const Schema = z.object({
  session_id: z.string().min(1),
  amount: z.number().positive(),
  channel: z.enum(["cash", "counter_upi", "pos_card"]).default("cash"),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(["staff", "manager", "owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = Schema.parse(await req.json());
    const result = recordCounterPayment(
      body.session_id,
      body.amount,
      body.channel,
      auth.session
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Counter payment failed" },
      { status: 400 }
    );
  }
}
