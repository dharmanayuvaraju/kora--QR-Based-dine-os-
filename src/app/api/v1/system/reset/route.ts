import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resetDemoDatabase, ensureDbReady, flushDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    resetDemoDatabase();
    return NextResponse.json({ ok: true });
  } finally {
    await flushDb();
  }
}
