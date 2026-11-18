import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { startItemPreparation, ensureDbReady, flushDb } from "@/lib/db/store";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["chef"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const order = startItemPreparation(id, auth.session);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start prep" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
