import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
    const session = await getAuthenticatedSession();
    const db = getDb();
    const user = session
      ? db.users.find((u) => u.id === session.userId && u.is_active) ?? null
      : null;

    return NextResponse.json(
      {
        user,
        mode: isSupabaseConfigured() ? "supabase" : "local-dual-mode",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    await flushDb();
  }
}
