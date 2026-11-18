import { NextRequest, NextResponse } from "next/server";
import { requestSessionBill } from "@/lib/db/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
}
