import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { updateRestaurantSettings, ensureDbReady, flushDb } from "@/lib/db/store";

const Schema = z.object({
  name: z.string().min(2).max(80).optional(),
  tagline: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  gstin: z.string().max(30).optional(),
  tax_rate_percent: z.number().min(0).max(28).optional(),
  service_charge_percent: z.number().min(0).max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  await ensureDbReady();
  try {
  const auth = await requireRole(["owner"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = Schema.parse(await req.json());
    const settings = updateRestaurantSettings(body, auth.session);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update settings" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
