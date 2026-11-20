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
    const auth = await requireRole(["owner"]);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "Only the restaurant owner can permanently delete employee accounts." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const db = getDb();
    const target = db.users.find((u) => u.id === id);

    if (!target) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    if (target.id === auth.session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      // Find auth user ID by ID or by email to ensure complete removal from Supabase Auth
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

      // Delete user from Supabase Auth (or proceed if already deleted)
      try {
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (authErr) {
          console.warn("[KORA Auth] Error deleting user in Supabase Auth:", authErr.message);
        }
      } catch (authEx) {
        console.warn("[KORA Auth] Exception deleting user from Supabase Auth:", authEx);
      }

      // Unlink any foreign key references so Postgres deletion never fails
      try {
        await supabaseAdmin.from("table_assignments").delete().eq("staff_id", id);
        await supabaseAdmin.from("table_assignments").update({ assigned_by: null }).eq("assigned_by", id);
        await supabaseAdmin.from("table_sessions").update({ closed_by: null }).eq("closed_by", id);
        await supabaseAdmin.from("orders").update({ approved_by: null }).eq("approved_by", id);
        await supabaseAdmin.from("order_items").update({ served_by: null }).eq("served_by", id);
        await supabaseAdmin.from("kitchen_tickets").update({ chef_id: null }).eq("chef_id", id);
        await supabaseAdmin.from("order_status_logs").update({ actor_id: null }).eq("actor_id", id);
        await supabaseAdmin.from("payments").update({ collected_by: null }).eq("collected_by", id);
        await supabaseAdmin.from("refunds").update({ authorized_by: null }).eq("authorized_by", id);
        await supabaseAdmin.from("inventory_movements").update({ actor_id: null }).eq("actor_id", id);
        await supabaseAdmin.from("audit_logs").update({ actor_id: null }).eq("actor_id", id);
        await supabaseAdmin.from("expenses").update({ recorded_by: null }).eq("recorded_by", id);
      } catch (unEx) {
        console.warn("[KORA DB] Unlink references exception:", unEx);
      }

      // Delete from public.users table
      try {
        await supabaseAdmin.from("users").delete().eq("id", id);
      } catch (dbEx) {
        console.warn("[KORA DB] Exception deleting user from public.users:", dbEx);
      }
    }

    const deleted = deleteEmployee(id, auth.session);
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
