import { NextResponse } from "next/server";
import { resetDemoDatabase } from "@/lib/db/store";

export async function POST() {
  resetDemoDatabase();
  return NextResponse.json({ ok: true });
}
