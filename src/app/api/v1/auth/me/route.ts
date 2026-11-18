import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  await ensureDbReady();
  try {
  const session = await getAuthenticatedSession();
  const db = getDb();
  const user = session
    ? db.users.find((u) => u.id === session.userId && u.is_active) ?? null
    : null;

  return NextResponse.json({
    user,
    mode: isSupabaseConfigured() ? "supabase" : "local-dual-mode",
    demo_accounts: db.users
      .filter((u) => u.is_active)
      .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role })),
  });
  } finally {
    await flushDb();
  }
}
