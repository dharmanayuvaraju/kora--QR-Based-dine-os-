"use client";

import { useMemo } from "react";
import { Check, CreditCard, Printer, Smartphone, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { RestaurantSettings, RestaurantTable, SessionBillSummary } from "@/lib/types";

interface PaymentModalProps {
  bill: SessionBillSummary;
  table: RestaurantTable;
  settings: RestaurantSettings | null;
  payChannel: "upi" | "card";
  setPayChannel: (c: "upi" | "card") => void;
  payAmountInput: string;
  setPayAmountInput: (v: string) => void;
  upiId: string;
  setUpiId: (v: string) => void;
  processingPay: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DemoPaymentModal({
  bill,
  table,
  settings,
  payChannel,
  setPayChannel,
  payAmountInput,
  setPayAmountInput,
  upiId,
  setUpiId,
  processingPay,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="kora-card-enter w-full max-w-md rounded-2xl border border-[#E8E1D6] bg-white p-6">
        <div className="flex items-start justify-between border-b border-stone-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#C2410C]">
              Demo payment (simulated, no real charge)
            </p>
            <h3 className="mt-1 font-serif text-lg font-semibold text-stone-900">
              {settings?.name} · {table.table_number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"
            aria-label="Close payment sheet"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          Demo payment: simulated, no real charge. Submitting records a test payment and
          issues your GST tax invoice.
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-stone-600">
            Amount to Pay (Full or Partial Split)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-lg font-semibold text-stone-500">₹</span>
            <input
              type="number"
              min={1}
              max={bill.balance_due}
              step="0.01"
              value={payAmountInput}
              onChange={(e) => setPayAmountInput(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-base font-semibold outline-none focus:border-[#C2410C]"
            />
            <button
              type="button"
              onClick={() => setPayAmountInput(String(bill.balance_due))}
              className="min-h-[44px] shrink-0 rounded-xl bg-stone-100 px-3.5 text-xs font-semibold text-stone-700"
            >
              Full
            </button>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">
            Total balance due: {formatCurrency(bill.balance_due)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setPayChannel("upi")}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${
              payChannel === "upi"
                ? "border-[#C2410C] bg-orange-50 text-[#9A3412]"
                : "border-stone-200 text-stone-600"
            }`}
          >
            <Smartphone className="h-4 w-4" strokeWidth={1.65} /> Simulated UPI
          </button>
          <button
            type="button"
            onClick={() => setPayChannel("card")}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${
              payChannel === "card"
                ? "border-[#C2410C] bg-orange-50 text-[#9A3412]"
                : "border-stone-200 text-stone-600"
            }`}
          >
            <CreditCard className="h-4 w-4" strokeWidth={1.65} /> Simulated Card
          </button>
        </div>

        {payChannel === "upi" ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-stone-600">Demo UPI Handle</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            Simulated Test Card ending 4242, Exp 12/29. No real card is charged.
          </div>
        )}

        <button
          type="button"
          disabled={processingPay}
          onClick={onConfirm}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#C2410C] py-3 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={2} />
          {processingPay
            ? "Recording Demo Payment..."
            : `Confirm Demo Payment · ${formatCurrency(Number(payAmountInput) || 0)}`}
        </button>
      </div>
    </div>
  );
}

const CONFETTI_PIECES = [
  { tx: "-72px", ty: "-68px", rot: "-140deg", color: "#C2410C" },
  { tx: "-48px", ty: "-86px", rot: "120deg", color: "#1E6B4B" },
  { tx: "-22px", ty: "-94px", rot: "-95deg", color: "#D97706" },
  { tx: "8px", ty: "-98px", rot: "160deg", color: "#C2410C" },
  { tx: "36px", ty: "-84px", rot: "-115deg", color: "#1E6B4B" },
  { tx: "66px", ty: "-70px", rot: "145deg", color: "#B45309" },
  { tx: "-82px", ty: "-30px", rot: "85deg", color: "#D97706" },
  { tx: "80px", ty: "-32px", rot: "-130deg", color: "#1E6B4B" },
  { tx: "-58px", ty: "-44px", rot: "175deg", color: "#C2410C" },
  { tx: "54px", ty: "-46px", rot: "-170deg", color: "#D97706" },
  { tx: "-16px", ty: "-72px", rot: "110deg", color: "#1E6B4B" },
  { tx: "20px", ty: "-74px", rot: "-105deg", color: "#C2410C" },
];

export function PaidReceiptModal({
  bill,
  table,
  settings,
  celebrate,
  reducedMotion,
  onClose,
}: {
  bill: SessionBillSummary;
  table: RestaurantTable;
  settings: RestaurantSettings | null;
  celebrate: boolean;
  reducedMotion: boolean;
  onClose: () => void;
}) {
  const paidRows = useMemo(
    () => bill.payments.filter((p) => p.status === "paid"),
    [bill.payments]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="kora-card-enter relative w-full max-w-sm overflow-visible rounded-2xl border border-[#E8E1D6] bg-white p-6 font-mono text-xs text-stone-800">
        {celebrate && !reducedMotion && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-10 left-1/2 z-10"
          >
            {CONFETTI_PIECES.map((bit, idx) => (
              <span
                key={idx}
                className="kora-confetti-bit absolute block h-2 w-2 rounded-[2px]"
                style={
                  {
                    backgroundColor: bit.color,
                    "--tx": bit.tx,
                    "--ty": bit.ty,
                    "--rot": bit.rot,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}

        <div className="text-center">
          <div className="kora-check-pop mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" strokeWidth={2.4} />
          </div>
          <p className="font-serif text-lg font-bold text-stone-900">
            {settings?.name}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">{settings?.address}</p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            GSTIN: {settings?.gstin}
          </p>
          <p className="mt-2 border-y border-dashed border-stone-300 py-1 font-semibold">
            PAID TAX INVOICE · {table.table_number}
          </p>
        </div>

        <div className="mt-3 space-y-1.5">
          {bill.line_items.map((li, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span>
                {li.quantity}× {li.item_name}
              </span>
              <span>{formatCurrency(li.item_total)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(bill.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST + SGST ({bill.tax_rate_percent}%)</span>
            <span>{formatCurrency(bill.tax_amount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-stone-900">
            <span>TOTAL PAID</span>
            <span>{formatCurrency(bill.amount_paid)}</span>
          </div>
        </div>

        <div className="mt-3 border-t border-dashed border-stone-300 pt-2 text-[10px] text-stone-500">
          {paidRows.map((p) => (
            <p key={p.id}>
              {p.receipt_number} · {p.method === "online" ? "DEMO ONLINE" : "COUNTER"} (
              {p.channel.toUpperCase()}) · {formatCurrency(p.amount)}
            </p>
          ))}
        </div>

        <div className="no-print mt-5 flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> Print / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
