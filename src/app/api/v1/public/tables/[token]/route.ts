import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getSessionBillSummary,
  resolveTableByQrToken,
  ensureDbReady,
  flushDb,
} from "@/lib/db/store";

export const dynamic = "force-dynamic";

const RECENT_CLOSED_WINDOW_MS = 30 * 60_000; // 30 minutes

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  await ensureDbReady();
  try {
    const { token } = await context.params;
    const db = getDb();
    const table = db.restaurant_tables.find(
      (t) => t.qr_token === token && t.is_active && t.status !== "inactive"
    );
    if (!table) {
      return NextResponse.json(
        {
          error:
            "Invalid or deactivated table QR code. Please scan a valid QR standee at your table or ask staff for assistance.",
        },
        { status: 404 }
      );
    }

    const preserveSessionId = req.nextUrl.searchParams.get("session_id");
    const forceNew = req.nextUrl.searchParams.get("new") === "1";

    // Priority 1: Existing active or payment_pending session always takes precedence
    const existingActive = db.table_sessions.find(
      (s) =>
        s.table_id === table.id &&
        (s.status === "active" || s.status === "payment_pending")
    );
    if (existingActive) {
      const bill = getSessionBillSummary(existingActive.id);
      return NextResponse.json(
        {
          table,
          session: existingActive,
          created_new_session: false,
          bill,
          settings: db.settings,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Priority 2: Preserve recently paid/closed session ONLY if user already had that session_id
    // (e.g. reload or returning from payment gateway to view paid GST invoice)
    if (!forceNew && preserveSessionId) {
      const closedToKeep = db.table_sessions.find(
        (s) =>
          s.id === preserveSessionId &&
          s.table_id === table.id &&
          s.status === "closed"
      );

      if (closedToKeep) {
        const bill = getSessionBillSummary(closedToKeep.id);
        if (bill.orders.length > 0 || bill.payments.length > 0) {
          return NextResponse.json(
            {
              table,
              session: closedToKeep,
              created_new_session: false,
              bill,
              settings: db.settings,
            },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
          );
        }
      }
    }

    // Priority 4: Table session is closed or awaiting staff activation
    return NextResponse.json(
      {
        table,
        session: null,
        is_open: false,
        created_new_session: false,
        bill: null,
        settings: db.settings,
        message: `Table ${table.table_number} is not currently open. Please ask our staff to seat you and open this table.`,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    await flushDb();
  }
}
