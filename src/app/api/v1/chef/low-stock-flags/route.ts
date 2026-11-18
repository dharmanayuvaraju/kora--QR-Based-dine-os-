import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { flagDishLowStock, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const Schema = z.object({
  menu_item_id: z.string().min(1),
  note: z.string().max(180).default(""),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["chef"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = Schema.parse(await req.json());
    const flag = flagDishLowStock(body.menu_item_id, body.note, auth.session);
    return NextResponse.json({ flag }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not flag low stock" },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
