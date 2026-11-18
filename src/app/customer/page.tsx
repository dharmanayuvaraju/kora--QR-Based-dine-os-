"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, QrCode, Smartphone, UtensilsCrossed } from "lucide-react";

export default function CustomerEntryPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleManualOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) return;
    // Allow pasting either a full /menu/t/<token> URL or the raw UUID token
    const match = cleaned.match(/\/menu\/t\/([a-zA-Z0-9-]+)/);
    const token = match ? match[1] : cleaned;
    if (token.length < 8) {
      setError("Please scan your table QR code or enter a valid table QR token.");
      return;
    }
    setError(null);
    router.push(`/menu/t/${encodeURIComponent(token)}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-6">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Hub
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-xs">
            <QrCode className="h-3.5 w-3.5 text-[#C2410C]" /> Table QR Required
          </span>
        </div>

        <div className="mt-8 rounded-3xl border border-[#E8E1D6] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C2410C] text-white">
            <UtensilsCrossed className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">
            Scan the QR code at your table
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Point your phone camera at the tabletop QR standee to open KORA&apos;s live
            digital menu for your seated table. No account or app download required.
          </p>

          <div className="mt-6 space-y-3 rounded-2xl bg-[#FAF7F2] p-4 text-xs text-stone-700">
            <div className="flex items-start gap-2.5">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#C2410C]" />
              <div>
                <p className="font-semibold text-stone-900">1. Scan your tabletop QR</p>
                <p className="mt-0.5 text-stone-600">
                  Each table has its own private QR token that opens or joins your table&apos;s
                  active dining session automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[#C2410C]" />
              <div>
                <p className="font-semibold text-stone-900">
                  2. Order, track live &amp; settle one combined bill
                </p>
                <p className="mt-0.5 text-stone-600">
                  Everyone at your table can add dishes into one shared session bill and
                  pay when finished.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleManualOpen}
            className="mt-6 border-t border-stone-100 pt-5"
          >
            <label
              htmlFor="table-qr-token"
              className="block text-xs font-semibold text-stone-700"
            >
              Have a scanned table link or QR token?
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="table-qr-token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste /menu/t/... URL or token"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs outline-none focus:border-[#C2410C] focus:bg-white"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#C2410C]"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
