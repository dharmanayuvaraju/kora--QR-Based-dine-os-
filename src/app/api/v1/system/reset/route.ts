import { NextResponse } from "next/server";
import { resetDemoDatabase, ensureDbReady, flushDb } from "@/lib/db/store";

export async function POST() {
  await ensureDbReady();
  try {
  resetDemoDatabase();
  return NextResponse.json({ ok: true });
  } finally {
    await flushDb();
  }
}
