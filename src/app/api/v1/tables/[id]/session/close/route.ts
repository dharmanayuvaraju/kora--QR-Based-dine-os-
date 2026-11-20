import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { closeTableSession, getDb, ensureDbReady, flushDb } from "@/lib/db/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner", "manager", "staff"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id: tableId } = await context.params;
    const db = getDb();
    const activeSession = db.table_sessions.find(
      (s) => s.table_id === tableId && (s.status === "active" || s.status === "payment_pending")
    );
    if (!activeSession) {
      return NextResponse.json({ error: "No active session found for this table." }, { status: 404 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      force?: boolean;
      reason?: string;
    };
    const canForce = body.force ?? true; // staff/manager/owner table clearing closes session
    const session = closeTableSession(
      activeSession.id,
      { id: auth.session.userId, name: auth.session.fullName, role: auth.session.role },
      { force: Boolean(canForce), reason: body.reason ?? "Table cleared by staff" }
    );
    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not close session." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
