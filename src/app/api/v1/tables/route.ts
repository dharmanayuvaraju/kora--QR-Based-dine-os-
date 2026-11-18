import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createTable, getDb, getSessionBillSummary } from "@/lib/db/store";

export async function GET() {
  const auth = await requireRole(["owner", "manager", "staff", "chef"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  const tables = db.restaurant_tables.map((table) => {
    const activeSession = db.table_sessions.find(
      (s) =>
        s.table_id === table.id &&
        (s.status === "active" || s.status === "payment_pending")
    );
    const assignment = db.table_assignments.find(
      (a) => a.table_id === table.id && a.is_active
    );
    const assignedStaff = assignment
      ? db.users.find((u) => u.id === assignment.staff_id) ?? null
      : null;
    const bill = activeSession ? getSessionBillSummary(activeSession.id) : null;
    return {
      ...table,
      assigned_staff: assignedStaff
        ? { id: assignedStaff.id, full_name: assignedStaff.full_name }
        : null,
      active_session: activeSession ?? null,
      bill: auth.session.role === "chef" ? null : bill,
    };
  });

  return NextResponse.json({ tables });
}

const CreateTableSchema = z.object({
  table_number: z.string().min(2).max(40),
  section: z.string().min(2).max(60).default("Main Dining"),
  capacity: z.number().int().min(1).max(20).default(4),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = CreateTableSchema.parse(await req.json());
    const table = createTable(
      body.table_number,
      body.section,
      body.capacity,
      auth.session
    );
    return NextResponse.json({ table }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create table" },
      { status: 400 }
    );
  }
}
