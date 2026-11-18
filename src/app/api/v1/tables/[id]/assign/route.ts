import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { assignStaffToTable } from "@/lib/db/store";

const Schema = z.object({ staff_id: z.string().min(1) });

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const assignment = assignStaffToTable(id, body.staff_id, auth.session);
    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign staff" },
      { status: 400 }
    );
  }
}
