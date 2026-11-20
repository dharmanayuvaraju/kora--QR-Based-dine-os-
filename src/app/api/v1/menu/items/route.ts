import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createMenuItem, ensureDbReady, flushDb, getDb } from "@/lib/db/store";

const Schema = z.object({
  category_id: z.string().min(1),
  name: z.string().min(2).max(100),
  description: z.string().max(300).default(""),
  price: z.number().min(1),
  dietary: z.enum(["veg", "non_veg", "vegan", "egg"]).default("veg"),
  spice_level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(1),
  prep_minutes: z.number().int().min(1).max(120).default(15),
  image_url: z
    .string()
    .default("/dishes/black-dal.jpg"),
  is_bestseller: z.boolean().default(false),
  is_available: z.boolean().default(true),
  stock_count: z.number().int().min(0).max(9999).default(20),
  variants: z
    .array(
      z.object({
        name: z.string().min(1),
        price_delta: z.number(),
        is_default: z.boolean().optional(),
      })
    )
    .optional(),
  addons: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().min(0),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = Schema.parse(await req.json());
    const db = getDb();
    const cleanName = body.name.trim();
    const isDuplicate = db.menu_items.some(
      (m) => !m.deleted_at && m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: `A dish named "${cleanName}" already exists on the menu.` },
        { status: 409 }
      );
    }
    const item = createMenuItem(body, auth.session);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create item" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
