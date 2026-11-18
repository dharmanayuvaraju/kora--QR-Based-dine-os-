import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { closeTableSession } from "@/lib/db/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["owner", "manager", "staff"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as {
      force?: boolean;
      reason?: string;
    };
    const canForce = body.force && ["owner", "manager"].includes(auth.session.role);
    const session = closeTableSession(
      id,
      { id: auth.session.userId, name: auth.session.fullName, role: auth.session.role },
      { force: Boolean(canForce), reason: body.reason }
    );
    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not close session" },
      { status: 400 }
    );
  }
}
