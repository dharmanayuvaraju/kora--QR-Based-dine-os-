import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";
import { setAuthCookie } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; role?: UserRole };
    const db = getDb();

    let user = body.email
      ? db.users.find(
          (u) => u.email.toLowerCase() === body.email!.trim().toLowerCase()
        )
      : body.role
      ? db.users.find((u) => u.role === body.role && u.is_active)
      : undefined;

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials. Use one of the active KORA employee emails." },
        { status: 401 }
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
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 400 }
    );
  }
}
