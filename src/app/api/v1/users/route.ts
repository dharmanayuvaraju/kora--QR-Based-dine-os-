import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createEmployee, getDb, ensureDbReady, flushDb } from "@/lib/db/store";

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
});

export async function POST(req: NextRequest) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = CreateUserSchema.parse(await req.json());
    const user = createEmployee(body, auth.session);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create employee" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
