import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { markItemServed, ensureDbReady, flushDb } from "@/lib/db/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["staff", "manager", "owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const order = markItemServed(id, auth.session, body.reason);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not mark item served" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
