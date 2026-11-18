import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { cancelOrderAuthorized } from "@/lib/db/store";

const Schema = z.object({ reason: z.string().min(3).max(240) });

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
    const order = cancelOrderAuthorized(id, body.reason, auth.session);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel order" },
      { status: 400 }
    );
  }
}
