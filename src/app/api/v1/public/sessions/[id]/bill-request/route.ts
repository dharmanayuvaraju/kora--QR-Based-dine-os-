import { NextRequest, NextResponse } from "next/server";
import { requestSessionBill, ensureDbReady, flushDb } from "@/lib/db/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as {
      method?: "online" | "counter";
    };
    const bill = requestSessionBill(id, body.method ?? "counter");
    return NextResponse.json({ bill });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not request bill" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
