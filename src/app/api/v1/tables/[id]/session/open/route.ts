import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { openTableSession } from "@/lib/db/store";

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
    const body = (await req.json().catch(() => ({}))) as { guest_count?: number };
    const session = openTableSession(id, body.guest_count ?? 2, auth.session);
    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open session" },
      { status: 400 }
    );
  }
}
