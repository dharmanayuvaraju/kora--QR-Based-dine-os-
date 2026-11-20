import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { softDeleteMenuItem, updateMenuItem, ensureDbReady, flushDb, getDb } from "@/lib/db/store";

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
    if (patch.name) {
      const db = getDb();
      const cleanName = String(patch.name).trim();
      const isDup = db.menu_items.some(
        (m) => m.id !== id && !m.deleted_at && m.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (isDup) {
        return NextResponse.json(
          { error: `A dish named "${cleanName}" already exists on the menu.` },
          { status: 409 }
        );
      }
    }
    const item = updateMenuItem(id, patch, auth.session);
    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not update item";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
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
