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
  full_name: z.string().min(2, "Full name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Please enter a valid email address."),
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

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = CreateUserSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input data." },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    // Strict role hierarchy enforcement
    if (body.role === "owner") {
      return NextResponse.json(
        { error: "Owner accounts can only be provisioned by A3Y platform administrators." },
        { status: 403 }
      );
    }

    if (auth.session.role === "manager" && body.role === "manager") {
      return NextResponse.json(
        { error: "Managers can only provision staff and chef accounts." },
        { status: 403 }
      );
    }

    const email = body.email.toLowerCase();
    const db = getDb();

    // Check duplicate in application store
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: "An account with this user ID already exists." },
        { status: 400 }
      );
    }

    let authUserId: string | undefined;
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: body.role },
        user_metadata: { full_name: body.full_name },
      });

      if (authErr) {
        const msg = authErr.message?.toLowerCase() || "";
        if (
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("duplicate") ||
          (authErr as { status?: number }).status === 422
        ) {
          return NextResponse.json(
            { error: "An account with this user ID already exists." },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: authErr.message || "Failed to provision employee in authentication service." },
          { status: 400 }
        );
      }

      if (authData?.user) {
        authUserId = authData.user.id;
      }
    }

    // Register local password fallback for offline/dual-mode
    registerLocalEmployeePassword(email, body.password);

    const user = createEmployee(
      {
        id: authUserId,
        full_name: body.full_name,
        email,
        role: body.role,
        phone: body.phone,
      },
      auth.session
    );

    if (supabaseAdmin) {
      await supabaseAdmin.from("users").upsert({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? null,
        is_active: true,
      });
    }

    return NextResponse.json(
      {
        user,
        credentials: {
          user_id: user.email,
          full_name: user.full_name,
          role: user.role,
          temp_password: body.password,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const errorMsg =
      err instanceof z.ZodError
        ? err.errors[0]?.message || "Invalid input"
        : err instanceof Error
        ? err.message
        : "Could not create employee";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  } finally {
    await flushDb();
  }
}
