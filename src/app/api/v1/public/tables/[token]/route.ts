import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getSessionBillSummary,
  resolveTableByQrToken,
  ensureDbReady,
  flushDb,
} from "@/lib/db/store";

export const dynamic = "force-dynamic";

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

    // If customer reloads right after paying, preserve their paid session & receipt
    const preserveSessionId = req.nextUrl.searchParams.get("session_id");
    const forceNew = req.nextUrl.searchParams.get("new") === "1";

    if (preserveSessionId && !forceNew) {
      const existingActive = db.table_sessions.find(
        (s) =>
          s.table_id === table.id &&
          (s.status === "active" || s.status === "payment_pending")
      );
      if (!existingActive) {
        const closedSession = db.table_sessions.find(
          (s) =>
            s.id === preserveSessionId &&
            s.table_id === table.id &&
            s.status === "closed"
        );
        if (closedSession) {
          const bill = getSessionBillSummary(closedSession.id);
          return NextResponse.json(
            {
              table,
              session: closedSession,
              created_new_session: false,
              bill,
              settings: db.settings,
            },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
          );
        }
      }
    }

    const resolved = resolveTableByQrToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: "Invalid or deactivated table QR code." },
        { status: 404 }
      );
    }

    const bill = getSessionBillSummary(resolved.session.id);
    return NextResponse.json(
      {
        table: resolved.table,
        session: resolved.session,
        created_new_session: resolved.createdNewSession,
        bill,
        settings: db.settings,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    await flushDb();
  }
}
