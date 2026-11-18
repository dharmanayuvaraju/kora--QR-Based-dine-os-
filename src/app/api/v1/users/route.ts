import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createEmployee,
  getDb,
  ensureDbReady,
  flushDb,
  registerLocalEmployeePassword,
} from "@/lib/db/store";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const db = getDb();
    return NextResponse.json({ users: db.users });
  } finally {
    await flushDb();
  }
}

const CreateUserSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email(),
  role: z.enum(["owner", "manager", "staff", "chef"]),
  phone: z.string().max(30).optional(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = CreateUserSchema.parse(await req.json());
    const user = createEmployee(
      {
        full_name: body.full_name,
        email: body.email,
        role: body.role,
        phone: body.phone,
      },
      auth.session
    );

    registerLocalEmployeePassword(user.email, body.password);

    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: user.role },
        user_metadata: { full_name: user.full_name },
      });
      if (authErr) {
        console.warn("[KORA Auth] Supabase createUser warning:", authErr.message);
      }
      await supabaseAdmin.from("users").upsert({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? null,
        is_active: true,
      });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create employee" },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
