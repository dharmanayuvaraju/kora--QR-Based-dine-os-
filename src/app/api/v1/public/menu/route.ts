import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";

export async function GET() {
  const db = getDb();
  const categories = db.menu_categories
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const items = db.menu_items.filter((m) => !m.deleted_at);

  return NextResponse.json({
    settings: db.settings,
    categories,
    items,
  });
}
