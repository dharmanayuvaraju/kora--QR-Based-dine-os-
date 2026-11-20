import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { rejectOrderByChef, ensureDbReady, flushDb } from "@/lib/db/store";

const Schema = z.object({
  reason: z.string().min(2).max(240),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["chef", "staff", "manager", "owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const order = rejectOrderByChef(id, body.reason, auth.session);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reject order" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
