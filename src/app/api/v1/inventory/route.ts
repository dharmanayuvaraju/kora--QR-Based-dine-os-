import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { adjustInventory, getDb } from "@/lib/db/store";

export async function GET() {
  const auth = await requireRole(["owner", "manager", "chef"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const db = getDb();
  return NextResponse.json({
    items: db.inventory_items,
    movements: db.inventory_movements.slice(0, 40),
  });
}

const AdjustSchema = z.object({
  inventory_item_id: z.string().min(1),
  movement_type: z.enum(["restock", "deduction", "wastage", "adjustment"]),
  quantity: z.number().positive(),
  note: z.string().max(180).default(""),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = AdjustSchema.parse(await req.json());
    const item = adjustInventory(
      body.inventory_item_id,
      body.movement_type,
      body.quantity,
      body.note,
      auth.session
    );
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not adjust stock" },
      { status: 400 }
    );
  }
}
