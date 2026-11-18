import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getDb,
  ensureDbReady,
  flushDb,
  verifyLocalEmployeePassword,
} from "@/lib/db/store";
import { setAuthCookie } from "@/lib/auth";
import { getSupabaseServerAnonClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid employee email."),
  password: z.string().min(6, "Password is required."),
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
    const raw = await req.json();
    const parsed = LoginSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid employee email and password." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerAnonClient();
      if (!supabase) {
        return NextResponse.json(
          { error: "Authentication service unavailable." },
          { status: 503 }
        );
      }
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (authError || !authData.user) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
    } else {
      if (!verifyLocalEmployeePassword(email, password)) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
    }

    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      return NextResponse.json(
        { error: "Employee profile not found in restaurant directory." },
        { status: 403 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "This employee account has been disabled by management." },
        { status: 403 }
      );
    }

    await setAuthCookie(user);
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication failed." },
      { status: 400 }
    );
  } finally {
    await flushDb();
  }
}
