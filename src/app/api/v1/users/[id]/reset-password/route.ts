import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb, ensureDbReady, flushDb, registerLocalEmployeePassword } from "@/lib/db/store";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const Schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = Schema.parse(await req.json());
    const db = getDb();
    const target = db.users.find((u) => u.id === id);

    if (!target) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      // Find auth user ID by ID or by email
      let authUserId = id;
      try {
        const { data: userById } = await supabaseAdmin.auth.admin.getUserById(id);
        if (!userById?.user) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
          const matching = listData?.users.find((u) => u.email?.toLowerCase() === target.email.toLowerCase());
          if (matching) {
            authUserId = matching.id;
          }
        }
      } catch {
        // continue with id
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: body.password,
      });

      if (updateErr) {
        console.warn("[KORA Auth] Error updating password in Supabase Auth:", updateErr.message);
      }
    }

    registerLocalEmployeePassword(target.email, body.password);

    // Resolve any pending password reset requests for this user
    if (Array.isArray(db.password_reset_requests)) {
      for (const req of db.password_reset_requests) {
        if ((req.user_id === id || req.email.toLowerCase() === target.email.toLowerCase()) && req.status === "pending") {
          req.status = "resolved";
          req.resolved_at = new Date().toISOString();
          req.resolved_by = auth.session.userId;
        }
      }
    }

    // Add audit log
    db.audit_logs.unshift({
      id: crypto.randomUUID(),
      actor_id: auth.session.userId,
      actor_name: auth.session.fullName,
      actor_role: auth.session.role,
      action: "PASSWORD_RESET_COMPLETED",
      entity_type: "user",
      entity_id: target.id,
      metadata: {
        email: target.email,
        full_name: target.full_name,
        role: target.role,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully set new password for ${target.full_name}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reset password." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
