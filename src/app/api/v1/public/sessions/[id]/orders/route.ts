import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCustomerOrder, getSessionBillSummary, ensureDbReady, flushDb } from "@/lib/db/store";

const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: z.string().min(1),
        variant_id: z.string().nullable().optional(),
        addon_ids: z.array(z.string()).optional(),
        quantity: z.number().int().min(1).max(50),
        instructions: z.string().max(240).nullable().optional(),
      })
    )
    .min(1),
  special_instructions: z.string().max(300).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  try {
    const { id } = await context.params;
    const bill = getSessionBillSummary(id);
    return NextResponse.json({
      orders: bill.orders,
      bill,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session not found" },
      { status: 404 }
    );
  }
  } finally {
    await flushDb();
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
  try {
    const { id } = await context.params;
    const raw = await req.json();
    const parsed = CreateOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const order = createCustomerOrder(
      id,
      parsed.data.items,
      parsed.data.special_instructions
    );
    const bill = getSessionBillSummary(id);
    return NextResponse.json({ order, bill }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not place order" },
      { status: 400 }
    );
  }
  } finally {
    await flushDb();
  }
}
