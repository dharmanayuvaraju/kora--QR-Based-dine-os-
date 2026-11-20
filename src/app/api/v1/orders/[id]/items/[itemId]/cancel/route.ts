import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrderItemByCustomer, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const Schema = z.object({
  reason: z.string().trim().min(2, "Cancellation reason is mandatory.").max(240),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  await ensureDbReady();
  try {
    const { id: orderId, itemId } = await context.params;
    const body = Schema.parse(await req.json().catch(() => ({})));
    const result = cancelOrderItemByCustomer(orderId, itemId, body.reason);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel item." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
