import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createCategory } from "@/lib/db/store";

const Schema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(180).default(""),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = Schema.parse(await req.json());
    const category = createCategory(body.name, body.description, auth.session);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create category" },
      { status: 400 }
    );
  }
}
