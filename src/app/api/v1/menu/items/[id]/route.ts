import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { softDeleteMenuItem, updateMenuItem, ensureDbReady, flushDb } from "@/lib/db/store";

export async function PATCH(
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
    const patch = await req.json();
    const item = updateMenuItem(id, patch, auth.session);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update item" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    softDeleteMenuItem(id, auth.session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not archive item" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
