"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Receipt,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { RoleAuthGate } from "@/components/RoleAuthGate";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useRealtime } from "@/hooks/useRealtime";
import { playChime } from "@/lib/sound";
import { formatCurrency, formatElapsed, formatTimeShort } from "@/lib/utils";
import type {
  OrderItem,
  PaymentChannel,
  RestaurantTable,
  SessionBillSummary,
  TableSession,
  User,
} from "@/lib/types";

interface StaffOverview {
  staff_name: string;
  ready_items: Array<{
    item: OrderItem;
    order_id: string;
    order_number: number;
    table_id: string;
    table_number: string;
    special_instructions: string | null;
    is_my_table: boolean;
  }>;
  tables: Array<
    RestaurantTable & {
      assigned_staff: { id: string; full_name: string } | null;
      is_my_table: boolean;
      active_session: TableSession | null;
      bill: SessionBillSummary | null;
    }
  >;
  bill_requests: Array<{
    table_number: string;
    section: string;
    is_my_table: boolean;
    bill: SessionBillSummary;
  }>;
  recently_served: Array<{
    id: string;
    order_number: number;
    table_number: string;
    item_name: string;
    quantity: number;
    served_at: string;
  }>;
}

function StaffWorkspace({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [data, setData] = useState<StaffOverview | null>(null);
  const [tab, setTab] = useState<"ready" | "tables" | "bills" | "history">("ready");
  const [onlyMyTables, setOnlyMyTables] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);

  // Counter Payment Modal
  const [collectTarget, setCollectTarget] = useState<SessionBillSummary | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectChannel, setCollectChannel] = useState<PaymentChannel>("cash");
  const [collecting, setCollecting] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/v1/staff/overview", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const { connected } = useRealtime((ev) => {
    loadOverview();
    if (ev.type === "item.ready") {
      playChime("item_ready", muted);
      setAlertText(ev.message);
      setTimeout(() => setAlertText(null), 6000);
    } else if (ev.type === "bill.requested") {
      playChime("new_order", muted);
      setAlertText(ev.message);
      setTimeout(() => setAlertText(null), 6000);
    }
  });

  const markServed = async (itemId: string) => {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/v1/staff/items/${itemId}/served`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        setAlertText(err.error ?? "Failed to mark served");
      } else {
        await loadOverview();
      }
    } finally {
      setBusyId(null);
    }
  };

  const openCollectModal = (bill: SessionBillSummary) => {
    setCollectTarget(bill);
    setCollectAmount(String(bill.balance_due));
    setCollectChannel("cash");
  };

  const confirmCounterPayment = async () => {
    if (!collectTarget) return;
    const amt = Number(collectAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setCollecting(true);
    try {
      const res = await fetch("/api/v1/payments/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: collectTarget.session_id,
          amount: amt,
          channel: collectChannel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertText(json.error ?? "Payment collection failed");
      } else {
        playChime("payment_success", muted);
        setAlertText(
          `Collected ${formatCurrency(json.payment.amount)} (${collectChannel.toUpperCase()}) · Receipt ${json.payment.receipt_number}`
        );
        setCollectTarget(null);
        await loadOverview();
      }
    } finally {
      setCollecting(false);
    }
  };

  const readyItems = (data?.ready_items ?? []).filter(
    (r) => !onlyMyTables || r.is_my_table
  );
  const tables = (data?.tables ?? []).filter(
    (t) => !onlyMyTables || t.is_my_table
  );
  const billRequests = (data?.bill_requests ?? []).filter(
    (b) => !onlyMyTables || b.is_my_table
  );

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-stone-900">
      <ConsoleHeader
        user={user}
        connected={connected}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onLogout={logout}
        subtitle="Floor Service Console"
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {alertText && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-950 px-4 py-3 text-xs font-medium text-emerald-50 shadow-sm">
            <span className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-emerald-400" />
              {alertText}
            </span>
            <button type="button" onClick={() => setAlertText(null)}>
              <X className="h-4 w-4 opacity-70" />
            </button>
          </div>
        )}

        {/* Top Metric Strip + Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab("ready")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === "ready"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <BellRing className="h-3.5 w-3.5" />
              Ready to Serve
              <span className="rounded-full bg-black/15 px-1.5 py-0.5 font-mono text-[11px]">
                {readyItems.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("bills")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === "bills"
                  ? "bg-[#C2410C] text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Bill Requests
              <span className="rounded-full bg-black/15 px-1.5 py-0.5 font-mono text-[11px]">
                {billRequests.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("tables")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === "tables"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Floor Tables ({tables.filter((t) => t.active_session).length} active)
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === "history"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Served History
            </button>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">
            <input
              type="checkbox"
              checked={onlyMyTables}
              onChange={(e) => setOnlyMyTables(e.target.checked)}
              className="accent-stone-900"
            />
            Only my assigned tables
          </label>
        </div>

        {/* ==================== READY TO SERVE PASS QUEUE ==================== */}
        {tab === "ready" && (
          <div className="mt-5">
            {readyItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/70" />
                <p className="mt-3 text-sm font-semibold text-stone-800">
                  Kitchen pass is clear — all ready dishes have been served!
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  You will receive an instant chime and card here the moment a chef marks any
                  item ready.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {readyItems.map((entry) => (
                  <article
                    key={entry.item.id}
                    className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500/50 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white">
                          {entry.table_number}
                        </span>
                        <span className="font-mono text-xs font-semibold text-stone-500">
                          Order #{entry.order_number}
                        </span>
                      </div>

                      <h3 className="mt-3.5 text-lg font-bold text-stone-900">
                        <span className="mr-1.5 font-mono text-emerald-700">
                          {entry.item.quantity}×
                        </span>
                        {entry.item.item_name_snapshot}
                      </h3>
                      {entry.item.variant_name_snapshot && (
                        <p className="text-xs text-stone-500">
                          Portion: {entry.item.variant_name_snapshot}
                        </p>
                      )}
                      {entry.item.instructions && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                          Guest Note: {entry.item.instructions}
                        </p>
                      )}
                      {entry.item.ready_at && (
                        <p className="mt-2.5 flex items-center gap-1 text-xs text-stone-500">
                          <Clock className="h-3.5 w-3.5" />
                          Waiting at pass: {formatElapsed(entry.item.ready_at)}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={busyId === entry.item.id}
                      onClick={() => markServed(entry.item.id)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {busyId === entry.item.id ? "Updating..." : "Confirm Served at Table"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== BILL REQUESTS & COUNTER COLLECTION ==================== */}
        {tab === "bills" && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {billRequests.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center text-sm text-stone-500">
                No pending counter bill requests right now. You can also collect payment for
                any active table under &ldquo;Floor Tables&rdquo;.
              </div>
            ) : (
              billRequests.map(({ table_number, section, bill }) => (
                <div
                  key={bill.session_id}
                  className="rounded-2xl border border-orange-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900">
                        {table_number} · {section}
                      </span>
                      <p className="mt-1.5 text-xs text-stone-500">
                        Requested{" "}
                        {bill.bill_requested_at
                          ? formatTimeShort(bill.bill_requested_at)
                          : "recently"}{" "}
                        · {bill.orders.length} order{bill.orders.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-stone-400">
                        Balance Due
                      </p>
                      <p className="font-mono text-xl font-bold text-[#C2410C]">
                        {formatCurrency(bill.balance_due)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 rounded-xl bg-stone-50 p-3 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Combined Total (incl. GST)</span>
                      <span className="font-mono">{formatCurrency(bill.grand_total)}</span>
                    </div>
                    {bill.amount_paid > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Already Paid (Online / Previous)</span>
                        <span className="font-mono">-{formatCurrency(bill.amount_paid)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openCollectModal(bill)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-xs font-semibold text-white hover:bg-[#C2410C]"
                  >
                    <Banknote className="h-4 w-4" />
                    Collect Counter Payment &amp; Settle
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== FLOOR TABLES OVERVIEW ==================== */}
        {tab === "tables" && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tables.map((t) => {
              const readyCount = (t.bill?.orders ?? []).reduce(
                (acc, o) => acc + o.items.filter((i) => i.status === "ready").length,
                0
              );
              return (
                <div
                  key={t.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs ${
                    t.active_session?.status === "payment_pending"
                      ? "border-orange-300"
                      : t.active_session
                      ? "border-stone-300"
                      : "border-stone-200/80 opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-stone-900">
                        {t.table_number}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          t.active_session?.status === "payment_pending"
                            ? "bg-orange-100 text-orange-800"
                            : t.active_session
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {t.active_session?.status === "payment_pending"
                          ? "Bill Due"
                          : t.active_session
                          ? "Occupied"
                          : "Available"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {t.section} · Waiter: {t.assigned_staff?.full_name ?? "Unassigned"}
                    </p>

                    {t.bill ? (
                      <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Orders</span>
                          <span className="font-mono font-semibold">
                            {t.bill.orders.length}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Balance Due</span>
                          <span className="font-mono font-semibold text-stone-900">
                            {formatCurrency(t.bill.balance_due)}
                          </span>
                        </div>
                        {readyCount > 0 && (
                          <p className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                            {readyCount} item{readyCount === 1 ? "" : "s"} ready at kitchen pass!
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {t.bill.orders.map((o) => (
                            <StatusBadge key={o.id} status={o.status} compact />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-stone-400">
                        Ready for next guests to scan QR.
                      </p>
                    )}
                  </div>

                  {t.bill && t.bill.balance_due > 0 && (
                    <button
                      type="button"
                      onClick={() => openCollectModal(t.bill!)}
                      className="mt-4 w-full rounded-xl border border-stone-300 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-900 hover:text-white"
                    >
                      Collect Counter Payment
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== SERVICE HISTORY ==================== */}
        {tab === "history" && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Dish Delivered</th>
                  <th className="px-4 py-3 text-right">Served At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(data?.recently_served ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-stone-900">
                      {row.table_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-500">
                      #{row.order_number}
                    </td>
                    <td className="px-4 py-3 text-stone-800">
                      {row.quantity}× {row.item_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-500">
                      {formatTimeShort(row.served_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* COUNTER PAYMENT COLLECTION MODAL */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C2410C]">
                  Counter Payment Confirmation
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold text-stone-900">
                  {collectTarget.table_number} · Balance{" "}
                  {formatCurrency(collectTarget.balance_due)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="rounded-full bg-stone-100 p-1.5 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-stone-600">
                Amount Received (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min={1}
                max={collectTarget.balance_due}
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-mono text-base font-semibold outline-none focus:border-stone-900"
              />
              <p className="mt-1 text-[11px] text-stone-500">
                Supports partial payment; table session auto-closes only when balance reaches ₹0.
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-stone-600">
                Collection Method
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "cash", label: "Cash", icon: Banknote },
                    { id: "counter_upi", label: "Counter UPI", icon: Smartphone },
                    { id: "pos_card", label: "POS Card", icon: CreditCard },
                  ] as const
                ).map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setCollectChannel(ch.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold ${
                        collectChannel === ch.id
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 text-stone-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {ch.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={collecting}
              onClick={confirmCounterPayment}
              className="mt-5 w-full rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {collecting ? "Recording & Auditing..." : "Confirm Payment Received"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <RoleAuthGate
      requiredRoles={["staff", "manager", "owner"]}
      preferredRole="staff"
    >
      {({ user, logout }) => <StaffWorkspace user={user} logout={logout} />}
    </RoleAuthGate>
  );
}
