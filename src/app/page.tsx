"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  ClipboardList,
  Lock,
  MapPin,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Store,
  UserCheck,
  Wifi,
} from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { DishImage } from "@/components/DishImage";
import { KoraMark } from "@/components/KoraMark";
import { QrCodeCard } from "@/components/QrCodeCard";

interface HubData {
  restaurant: {
    name: string;
    tagline: string;
    address: string;
    gstin: string;
    tax_rate_percent: number;
  };
  mode: string;
  storage_mode?: string;
  authenticated: boolean;
  current_role: string | null;
  stats: {
    active_sessions: number;
    pending_kitchen: number;
    ready_items: number;
    bill_requests: number;
    total_tables: number;
  };
  tables: Array<{
    id: string;
    table_number: string;
    section: string;
    capacity: number;
    qr_token: string;
    status: string;
    session_status: string | null;
    order_count: number;
  }>;
}

const FEATURED_PLATES = [
  { src: "/dishes/chicken-65.jpg", name: "Guntur Chilli Chicken 65", price: "₹320" },
  { src: "/dishes/black-dal.jpg", name: "24-Hour Black Dal Kora", price: "₹340" },
  { src: "/dishes/kokum-fizz.jpg", name: "Kokum & Smoked Salt Fizz", price: "₹165" },
];

export default function PlatformHubPage() {
  const [hub, setHub] = useState<HubData | null>(null);
  const [resetting, setResetting] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/system/hub", { cache: "no-store" });
      if (res.ok) setHub(await res.json());
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const { connected } = useRealtime((ev) => {
    setLastEvent(ev.message);
    loadHub();
  });

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch("/api/v1/system/reset", { method: "POST" });
      await loadHub();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="kora-grain min-h-screen bg-[#FAF7F2] text-[#1C1917]">
      {/* Solid Low-Overhead Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-[#E7DFD3] bg-[#FAF7F2]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <KoraMark className="h-9 w-9" />
            <div>
              <p className="font-serif text-lg font-semibold leading-none tracking-tight">
                {hub?.restaurant.name ?? "KORA Kitchen & Grill"}
              </p>
              <p className="mt-0.5 text-[11px] font-medium tracking-[0.12em] text-stone-500 uppercase">
                Hyderabad Bistro · Dining &amp; Kitchen OS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:inline-flex">
              <Wifi className="h-3.5 w-3.5" strokeWidth={1.75} />
              {connected
                ? hub?.mode === "supabase"
                  ? "Supabase Live Sync"
                  : "Live Sync Active"
                : "Connecting..."}
            </span>
            {hub?.current_role === "owner" && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
              >
                <RotateCcw
                  className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`}
                  strokeWidth={1.75}
                />
                Reset Service Data
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:py-12">
        {/* Asymmetric Offset Editorial Hero */}
        <section className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7 lg:pr-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5DACB] bg-white px-3 py-1 text-xs font-medium text-stone-700">
              <span className="h-2 w-2 rounded-full bg-[#C2410C]" />
              Wood-Fired Kitchen · Live Table Service
            </div>

            <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
              Tabletop ordering built for a busy dinner pass.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Guests scan the QR standee at their table to browse live dish availability and
              order without an app. Kitchen chefs approve tickets item by item, waiters get
              instant pass pings, and every order rolls into one GST table bill.
            </p>

            {/* Real Food Photography Preview Strip */}
            <div className="mt-7 grid grid-cols-3 gap-3 sm:max-w-lg">
              {FEATURED_PLATES.map((plate, i) => (
                <div
                  key={plate.name}
                  className={`overflow-hidden rounded-2xl border border-[#E7DFD3] bg-white p-1.5 ${
                    i === 1 ? "sm:translate-y-3" : ""
                  }`}
                >
                  <DishImage
                    src={plate.src}
                    alt={plate.name}
                    variant="thumb"
                    priority
                    className="aspect-square w-full rounded-xl"
                  />
                  <div className="px-1 pt-2 pb-1">
                    <p className="truncate text-[11px] font-semibold text-stone-900">
                      {plate.name}
                    </p>
                    <p className="font-mono text-[10px] text-[#C2410C]">{plate.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offset Right Live Service Board */}
          <div className="lg:col-span-5 lg:mt-6">
            <div className="rounded-3xl border border-[#E5DACB] bg-white p-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    Tonight on the Floor
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-stone-600">
                    <MapPin className="h-3.5 w-3.5 text-[#C2410C]" strokeWidth={1.75} />
                    {hub?.restaurant.address ?? "Road No. 36, Jubilee Hills, Hyderabad 500033"}
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#C2410C]" strokeWidth={1.65} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#FAF7F2] p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    Active Tables
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-stone-900">
                    {hub?.stats.active_sessions ?? "0"}
                    <span className="text-sm font-normal text-stone-400">
                      /{hub?.stats.total_tables ?? 8}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50/90 p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
                    Pending Chef
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-900">
                    {hub?.stats.pending_kitchen ?? "0"}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50/90 p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-800">
                    Ready at Pass
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-900">
                    {hub?.stats.ready_items ?? "0"}
                  </p>
                </div>
                <div className="rounded-2xl bg-orange-50/90 p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-orange-800">
                    Bill Requests
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-orange-900">
                    {hub?.stats.bill_requests ?? "0"}
                  </p>
                </div>
              </div>

              {lastEvent && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate font-medium">{lastEvent}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Five Role Workspaces */}
        <section className="mt-14">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold text-stone-900">
              Restaurant Consoles
            </h2>
            <span className="text-xs text-stone-500">
              Role-gated staff workspaces and tabletop guest menu
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Link
              href="/customer"
              className="group flex flex-col justify-between rounded-2xl border border-[#E5DACB] bg-white p-5 transition hover:border-[#C2410C]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200/80 bg-orange-50 text-[#C2410C]">
                    <QrCode className="h-5 w-5" strokeWidth={1.65} />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /customer
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Guest QR Ordering
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Zero-login dining menu opened by scanning your physical tabletop QR
                  standee, with live tracking and combined billing.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#C2410C]">
                Scan Table QR
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>

            <Link
              href="/chef"
              className="group flex flex-col justify-between rounded-2xl border border-[#E5DACB] bg-white p-5 transition hover:border-amber-600/60"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-700">
                    <ChefHat className="h-5 w-5" strokeWidth={1.65} />
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                    {hub?.stats.pending_kitchen ?? 0} pending
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">Chef KDS</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Order approval authority, rejection reasons, item-level prep timers,
                  pass alerts, 86 controls, and low-stock flags.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-amber-800">
                Chef Sign In
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>

            <Link
              href="/staff"
              className="group flex flex-col justify-between rounded-2xl border border-[#E5DACB] bg-white p-5 transition hover:border-emerald-600/60"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700">
                    <UserCheck className="h-5 w-5" strokeWidth={1.65} />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] text-emerald-700">
                    {hub?.stats.ready_items ?? 0} ready
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Floor Staff Console
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Real-time pickup alerts per ready item, assigned tables, mark served, and
                  counter cash or UPI collection.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                Staff Sign In
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>

            <Link
              href="/manager"
              className="group flex flex-col justify-between rounded-2xl border border-[#E5DACB] bg-white p-5 transition hover:border-sky-600/60"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-sky-700">
                    <ClipboardList className="h-5 w-5" strokeWidth={1.65} />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /manager
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Manager Operations
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Live floor map, waiter table assignment, stock counts, chef low-stock
                  flags, cancellations, and refunds.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-sky-700">
                Manager Sign In
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>

            <Link
              href="/owner"
              className="group flex flex-col justify-between rounded-2xl border border-[#E5DACB] bg-white p-5 transition hover:border-stone-900"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white">
                    <Store className="h-5 w-5" strokeWidth={1.65} />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /owner
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Owner Executive
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Revenue analytics, menu pricing and stock counts, QR standee studio, team
                  roles, GST settings, and audit trail.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-stone-900">
                Owner Sign In
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>
          </div>
        </section>

        {/* Staff-Only Table QR Directory */}
        <section className="mt-12">
          <div className="mb-4">
            <h2 className="font-serif text-xl font-semibold text-stone-900">
              Table QR Standees
            </h2>
            <p className="mt-0.5 text-xs text-stone-600">
              Each physical table uses a private UUID token so guests can only order from
              their seated table.
            </p>
          </div>

          {hub?.authenticated && hub.tables.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {hub.tables.map((table) => (
                <div key={table.id} className="relative">
                  <div className="mb-1.5 flex items-center justify-between px-1 text-[11px]">
                    <span className="font-medium text-stone-500">
                      Seats {table.capacity} · {table.order_count} order
                      {table.order_count === 1 ? "" : "s"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        table.session_status === "payment_pending"
                          ? "bg-orange-100 text-orange-800"
                          : table.session_status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-200/80 text-stone-600"
                      }`}
                    >
                      {table.session_status === "payment_pending"
                        ? "Bill Requested"
                        : table.session_status === "active"
                        ? "Dining Active"
                        : "Available"}
                    </span>
                  </div>
                  <QrCodeCard
                    tableNumber={table.table_number}
                    section={table.section}
                    qrToken={table.qr_token}
                    restaurantName={hub.restaurant.name}
                    compact
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E5DACB] bg-white p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700">
                  <Lock className="h-5 w-5" strokeWidth={1.65} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    Table QR links are restricted to signed-in staff
                  </h3>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-600">
                    Secret table token links are hidden from public visitors. Guests scan
                    the physical QR standee at their table; signed-in staff can view and
                    print QR standees here or inside the Owner and Manager consoles.
                  </p>
                </div>
              </div>
              <Link
                href="/owner"
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#C2410C]"
              >
                Staff Sign In
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
