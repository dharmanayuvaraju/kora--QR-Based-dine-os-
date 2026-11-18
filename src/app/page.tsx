"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  ClipboardList,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Store,
  UserCheck,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917]">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#FAF7F2]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C2410C] text-white shadow-xs">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
            <div>
              <p className="font-serif text-lg font-semibold leading-none tracking-tight">
                {hub?.restaurant.name ?? "KORA Kitchen & Grill"}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                Single-Restaurant QR Ordering & Hospitality OS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:inline-flex">
              <Wifi className="h-3.5 w-3.5" />
              {connected
                ? hub?.mode === "supabase"
                  ? "Supabase Live Sync"
                  : "Real-time Engine Active"
                : "Connecting..."}
            </span>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
              Reset Service Data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Editorial Hero + Live Telemetry */}
        <section className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white px-3 py-1 text-xs font-medium text-stone-700">
              <ShieldCheck className="h-3.5 w-3.5 text-[#C2410C]" />
              5 Unified Surfaces · Server-Authoritative Pricing · Item-Level KDS
            </div>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              From table QR scan to kitchen pass, service &amp; settlement.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Open any role workspace in a separate tab to watch orders, chef approvals,
              item-level readiness, waiter delivery, and combined table billing sync live
              without refreshing.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
              <div className="rounded-xl bg-stone-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Active Tables
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-stone-900">
                  {hub?.stats.active_sessions ?? "—"}
                  <span className="text-sm font-normal text-stone-400">
                    /{hub?.stats.total_tables ?? 8}
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/80 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
                  Pending Chef
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-900">
                  {hub?.stats.pending_kitchen ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-800">
                  Ready at Pass
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-900">
                  {hub?.stats.ready_items ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50/80 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-orange-800">
                  Bill Requests
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-orange-900">
                  {hub?.stats.bill_requests ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {lastEvent && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-700 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold uppercase tracking-wider text-stone-400">
              Live Stream
            </span>
            <span className="font-medium">{lastEvent}</span>
          </div>
        )}

        {/* Five Role Workspaces */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-stone-900">
              Application Surfaces
            </h2>
            <span className="text-xs text-stone-500">
              Single Next.js app · RBAC-enforced employee routes
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Link
              href="/customer"
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-[#C2410C]/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#C2410C]">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /customer
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Guest QR Ordering
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Zero-login table dining menu, dish customization, live item tracker,
                  Razorpay UPI/Card &amp; counter billing.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#C2410C]">
                Open Dining Menu
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/chef"
              className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#151921] p-5 text-zinc-100 transition hover:border-amber-500/60 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <ChefHat className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-[11px] text-amber-300">
                    {hub?.stats.pending_kitchen ?? 0} pending
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">Chef KDS</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Order approval authority, rejection reason capture, item-level prep
                  timers, instant pass alerts &amp; 86 toggle.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-amber-400">
                Launch Kitchen Display
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/staff"
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-emerald-500/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <UserCheck className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] text-emerald-700">
                    {hub?.stats.ready_items ?? 0} ready
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Floor Staff Console
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Real-time pickup alerts per ready item, assigned tables, mark served &amp;
                  counter cash/UPI collection.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                Open Service Console
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/manager"
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-sky-500/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /manager
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Manager Operations
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Live floor map, waiter table assignment, cancellations, authorized
                  refunds, stock &amp; daily ops.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-sky-700">
                Open Floor Ops
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/owner"
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-900 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white">
                    <Store className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-600">
                    /owner
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  Owner Executive
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Revenue &amp; P&amp;L analytics, menu pricing CRUD, QR studio, team
                  roles, GST settings &amp; audit trail.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-stone-900">
                Open Executive Suite
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* Live Permanent Table QR Directory */}
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold text-stone-900">
                Live Table QR Codes
              </h2>
              <p className="mt-0.5 text-xs text-stone-600">
                Every physical table has a permanent unguessable UUID token. Scan with a
                phone or open directly — Table 05 has an active multi-order session, Table
                02 has a partial payment pending.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(hub?.tables ?? []).map((table) => (
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
                  restaurantName={hub?.restaurant.name}
                  compact
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
