import { NextResponse } from "next/server";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
    const db = getDb();
    const categories = db.menu_categories
      .filter((c) => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
    const items = db.menu_items.filter((m) => !m.deleted_at);

    return NextResponse.json(
      {
        settings: db.settings,
        categories,
        items,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    await flushDb();
  }
}
