import { NextRequest, NextResponse } from "next/server";
import { getDb, getSessionBillSummary, resolveTableByQrToken, ensureDbReady, flushDb } from "@/lib/db/store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  await ensureDbReady();
  try {
  const { token } = await context.params;
  const resolved = resolveTableByQrToken(token);
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Invalid or deactivated table QR code. Please scan a valid QR standee at your table or ask staff for assistance.",
      },
      { status: 404 }
    );
  }

  const db = getDb();
  const bill = getSessionBillSummary(resolved.session.id);

  return NextResponse.json({
    table: resolved.table,
    session: resolved.session,
    created_new_session: resolved.createdNewSession,
    bill,
    settings: db.settings,
  });
  } finally {
    await flushDb();
  }
}
