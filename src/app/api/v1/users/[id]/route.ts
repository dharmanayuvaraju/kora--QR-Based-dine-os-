import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  toggleEmployeeActive,
  deleteEmployee,
  getDb,
  ensureDbReady,
  flushDb,
} from "@/lib/db/store";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const Schema = z.object({ is_active: z.boolean() });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner", "manager"]);
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

    if (auth.session.role === "manager" && !["staff", "chef"].includes(target.role)) {
      return NextResponse.json(
        { error: "Managers cannot modify Owner or Manager accounts." },
        { status: 403 }
      );
    }

    if (target.id === auth.session.userId) {
      return NextResponse.json(
        { error: "You cannot disable your own account." },
        { status: 400 }
      );
    }

    const user = toggleEmployeeActive(id, body.is_active, auth.session);

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      // 876600h is ~100 years. Setting ban_duration to "none" unbans the user in Supabase Auth.
      const banDuration = body.is_active ? "none" : "876600h";
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: banDuration,
      });

      if (banErr) {
        console.warn("[KORA Auth] Error updating ban duration in Supabase Auth:", banErr.message);
      }

      await supabaseAdmin.from("users").upsert({
        id: user.id,
        is_active: user.is_active,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update employee" },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const db = getDb();
    const target = db.users.find((u) => u.id === id);

    if (!target) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    if (auth.session.role === "manager" && !["staff", "chef"].includes(target.role)) {
      return NextResponse.json(
        { error: "Managers cannot delete Owner or Manager accounts." },
        { status: 403 }
      );
    }

    if (target.id === auth.session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const deleted = deleteEmployee(id, auth.session);

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      // Delete user from Supabase Auth
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authErr) {
        console.warn("[KORA Auth] Error deleting user in Supabase Auth:", authErr.message);
      }
      // Delete from public.users table
      await supabaseAdmin.from("users").delete().eq("id", id);
    }

    return NextResponse.json({ ok: true, deleted_id: id, user: deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete employee" },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
