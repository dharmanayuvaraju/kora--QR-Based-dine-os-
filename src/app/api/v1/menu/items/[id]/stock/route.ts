import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { updateMenuItemStock, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    stock_count: z.number().int().min(0).max(9999).optional(),
    delta: z.number().int().min(-500).max(500).optional(),
  })
  .refine(
    (v) => typeof v.stock_count === "number" || typeof v.delta === "number",
    "Provide either stock_count or delta."
  );

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
    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const item = updateMenuItemStock(id, body, auth.session);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update stock" },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
