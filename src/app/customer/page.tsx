"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, QrCode, UtensilsCrossed } from "lucide-react";
import { QrCodeCard } from "@/components/QrCodeCard";

interface TableCardInfo {
  id: string;
  table_number: string;
  section: string;
  capacity: number;
  qr_token: string;
  session_status: string | null;
  order_count: number;
}

export default function CustomerEntryPage() {
  const [tables, setTables] = useState<TableCardInfo[]>([]);
  const [restaurantName, setRestaurantName] = useState("KORA Kitchen & Grill");

  useEffect(() => {
    fetch("/api/v1/system/hub", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setTables(d.tables ?? []);
        if (d.restaurant?.name) setRestaurantName(d.restaurant.name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Platform Hub
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-xs">
            <QrCode className="h-3.5 w-3.5 text-[#C2410C]" /> Zero-Registration Table Ordering
          </span>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C2410C] text-white">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">
              Select or Scan Your Table QR
            </h1>
            <p className="text-xs text-stone-600 sm:text-sm">
              Customers cannot edit table numbers via URL parameters — each table opens its
              own cryptographic UUID token route <code className="font-mono">/menu/t/:token</code>.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((t) => (
            <div key={t.id}>
              <div className="mb-1.5 flex items-center justify-between px-1 text-[11px]">
                <span className="text-stone-500">Seats {t.capacity}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    t.session_status === "payment_pending"
                      ? "bg-orange-100 text-orange-800"
                      : t.session_status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {t.session_status === "payment_pending"
                    ? "Bill Requested"
                    : t.session_status === "active"
                    ? `${t.order_count} Active Order${t.order_count === 1 ? "" : "s"}`
                    : "Available"}
                </span>
              </div>
              <QrCodeCard
                tableNumber={t.table_number}
                section={t.section}
                qrToken={t.qr_token}
                restaurantName={restaurantName}
                compact
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
