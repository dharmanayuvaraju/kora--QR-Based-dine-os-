import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ensureDbReady, flushDb } from "@/lib/db/store";
import { publishRealtimeEvent } from "@/lib/realtime";
import type { PasswordResetRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().email("Enter a valid employee email."),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
    const raw = await req.json().catch(() => ({}));
    const parse = Schema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Please enter a valid employee email address." },
        { status: 400 }
      );
    }

    const email = parse.data.email.toLowerCase();
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);

    if (!user) {
      return NextResponse.json(
        { error: "No employee account found with this email." },
        { status: 404 }
      );
    }

    if (user.role === "owner") {
      return NextResponse.json(
        { error: "Restaurant owner accounts can only be reset by platform operations directly." },
        { status: 403 }
      );
    }

    if (!Array.isArray(db.password_reset_requests)) {
      db.password_reset_requests = [];
    }

    // Check if there's already an open pending request for this user
    const existing = db.password_reset_requests.find(
      (r) => r.email.toLowerCase() === email && r.status === "pending"
    );

    const nowIso = new Date().toISOString();
    const requestId = existing?.id || crypto.randomUUID();

    if (!existing) {
      const resetReq: PasswordResetRequest = {
        id: requestId,
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: "pending",
        created_at: nowIso,
      };
      db.password_reset_requests.unshift(resetReq);

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: user.role,
        action: "PASSWORD_RESET_REQUESTED",
        entity_type: "user",
        entity_id: user.id,
        metadata: {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
        created_at: nowIso,
      });

      publishRealtimeEvent({
        type: "auth.password_reset_requested",
        channel: "restaurant:notifications",
        message: `Password reset requested by ${user.full_name} (${user.role.toUpperCase()})`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Password reset requested for ${user.full_name}. The restaurant owner has been notified and can set your new password in the Owner Console.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit reset request." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
