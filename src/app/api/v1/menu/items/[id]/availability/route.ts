import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { toggleMenuItemAvailability } from "@/lib/db/store";

const Schema = z.object({ is_available: z.boolean() });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["owner", "manager", "chef"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const item = toggleMenuItemAvailability(id, body.is_available, auth.session);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update availability" },
      { status: 400 }
    );
  }
}
