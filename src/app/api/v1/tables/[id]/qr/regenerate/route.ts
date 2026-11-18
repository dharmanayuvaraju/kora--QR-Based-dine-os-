import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { regenerateTableQr } from "@/lib/db/store";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const table = regenerateTableQr(id, auth.session);
    return NextResponse.json({ table });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate QR" },
      { status: 400 }
    );
  }
}
