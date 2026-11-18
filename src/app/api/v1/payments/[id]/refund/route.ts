import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { issuePaymentRefund, ensureDbReady, flushDb } from "@/lib/db/store";

const Schema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(3).max(240),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const refund = issuePaymentRefund(id, body.amount, body.reason, auth.session);
    return NextResponse.json({ refund });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refund failed" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
