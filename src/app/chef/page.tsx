"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  History,
  Package,
  Utensils,
  X,
} from "lucide-react";
import { RoleAuthGate } from "@/components/RoleAuthGate";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useRealtime } from "@/hooks/useRealtime";
import { playChime } from "@/lib/sound";
import { formatElapsed, formatTimeShort } from "@/lib/utils";
import {
  REJECTION_REASONS,
  type InventoryItem,
  type MenuItem,
  type Order,
  type User,
} from "@/lib/types";

interface ChefPayload {
  pending: Order[];
  preparing: Order[];
  ready: Order[];
  rejected: Order[];
  history: Order[];
  menu_items: MenuItem[];
  inventory_low: InventoryItem[];
}

function ChefWorkspace({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [data, setData] = useState<ChefPayload | null>(null);
  const [tab, setTab] = useState<"kds" | "availability" | "history">("kds");
  const [muted, setMuted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Reject Order / Item Modal
  const [rejectTarget, setRejectTarget] = useState<{
    kind: "order" | "item";
    id: string;
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [customRejectReason, setCustomRejectReason] = useState("");

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/v1/chef/orders", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchOrders();
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [fetchOrders]);

  const { connected } = useRealtime((ev) => {
    fetchOrders();
    if (ev.type === "order.created") {
      playChime("new_order", muted);
      setBanner(ev.message);
      setTimeout(() => setBanner(null), 5000);
    }
  });

  const postAction = async (url: string, body?: unknown, idKey?: string) => {
    setBusyId(idKey ?? url);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner(json.error ?? "Action failed");
      } else {
        await fetchOrders();
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    setBusyId(item.id);
    try {
      await fetch(`/api/v1/menu/items/${item.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !item.is_available }),
      });
      await fetchOrders();
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const reason =
      customRejectReason.trim() || rejectReason || REJECTION_REASONS[0];
    const url =
      rejectTarget.kind === "order"
        ? `/api/v1/chef/orders/${rejectTarget.id}/reject`
        : `/api/v1/chef/items/${rejectTarget.id}/reject`;
    await postAction(url, { reason }, rejectTarget.id);
    setRejectTarget(null);
    setCustomRejectReason("");
  };

  const pending = data?.pending ?? [];
  const preparing = data?.preparing ?? [];
  const ready = data?.ready ?? [];

  return (
    <div className="min-h-screen bg-[#0C0E12] text-zinc-100">
      <ConsoleHeader
        user={user}
        connected={connected}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onLogout={logout}
        theme="dark"
        subtitle="Kitchen Display System"
      />

      {/* KDS Sub-toolbar */}
      <div className="border-b border-zinc-800/80 bg-[#11141A]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab("kds")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "kds"
                  ? "bg-amber-500 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Live KDS Board
              <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[11px]">
                {pending.length + preparing.length + ready.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("availability")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "availability"
                  ? "bg-amber-500 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <Utensils className="h-3.5 w-3.5" />
              86 / Item Availability
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "history"
                  ? "bg-amber-500 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Rejected &amp; History ({(data?.rejected.length ?? 0) + (data?.history.length ?? 0)})
            </button>
          </div>

          {(data?.inventory_low.length ?? 0) > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <Package className="h-3.5 w-3.5" />
              Low Stock:{" "}
              <span className="font-semibold">
                {data?.inventory_low.map((i) => i.name).join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {banner && (
        <div className="mx-auto max-w-[1600px] px-4 pt-3 sm:px-6">
          <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-medium text-amber-200">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        {/* ==================== 3-COLUMN LIVE KDS ==================== */}
        {tab === "kds" && (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* COLUMN 1: NEW ORDERS (APPROVAL AUTHORITY) */}
            <section className="flex flex-col rounded-2xl border border-amber-500/25 bg-[#12151C]">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                    New Orders · Approval
                  </h2>
                </div>
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                  {pending.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {pending.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    All incoming orders reviewed. Waiting for next table order...
                  </div>
                ) : (
                  pending.map((order) => (
                    <article
                      key={order.id}
                      className="overflow-hidden rounded-xl border border-amber-500/35 bg-[#181C25] shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800 bg-amber-500/10 px-4 py-2.5">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-lg font-bold text-white">
                            #{order.order_number}
                          </span>
                          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-bold text-amber-300">
                            {order.table_number}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-amber-300">
                          <Clock className="h-3.5 w-3.5" />
                          {formatElapsed(order.created_at, nowMs)}
                        </span>
                      </div>

                      <div className="p-4">
                        {order.special_instructions && (
                          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 p-2.5 text-xs font-semibold text-amber-200">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                            <span>{order.special_instructions}</span>
                          </div>
                        )}

                        <ul className="space-y-2.5">
                          {order.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start justify-between gap-2 text-sm"
                            >
                              <div>
                                <p className="font-semibold text-zinc-100">
                                  <span className="mr-1.5 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300">
                                    {item.quantity}×
                                  </span>
                                  {item.item_name_snapshot}
                                  {item.variant_name_snapshot && (
                                    <span className="ml-1.5 text-xs font-normal text-zinc-400">
                                      ({item.variant_name_snapshot})
                                    </span>
                                  )}
                                </p>
                                {item.addons.length > 0 && (
                                  <p className="mt-0.5 pl-7 text-xs text-zinc-400">
                                    + {item.addons.map((a) => a.addon_name_snapshot).join(", ")}
                                  </p>
                                )}
                                {item.instructions && (
                                  <p className="mt-0.5 pl-7 text-xs font-medium text-amber-300">
                                    Note: {item.instructions}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-4 grid grid-cols-2 gap-2.5 pt-2">
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              setRejectTarget({
                                kind: "order",
                                id: order.id,
                                label: `Order #${order.order_number} (${order.table_number})`,
                              })
                            }
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" /> Reject
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              postAction(`/api/v1/chef/orders/${order.id}/accept`, undefined, order.id)
                            }
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" /> Accept Order
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            {/* COLUMN 2: PREPARING (ITEM-LEVEL INDEPENDENT CONTROLS) */}
            <section className="flex flex-col rounded-2xl border border-orange-500/25 bg-[#12151C]">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-orange-300">
                    Preparing · Item Control
                  </h2>
                </div>
                <span className="rounded-md bg-orange-500/20 px-2 py-0.5 font-mono text-xs font-bold text-orange-300">
                  {preparing.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {preparing.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    No active tickets on the line. Accept an incoming order to begin cooking.
                  </div>
                ) : (
                  preparing.map((order) => {
                    const elapsedMins =
                      (nowMs - new Date(order.created_at).getTime()) / 60000;
                    const urgent = elapsedMins >= 15;
                    return (
                      <article
                        key={order.id}
                        className={`overflow-hidden rounded-xl border bg-[#181C25] ${
                          urgent ? "border-rose-500/60" : "border-zinc-700/80"
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-lg font-bold text-white">
                              #{order.order_number}
                            </span>
                            <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                              {order.table_number}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                              urgent ? "text-rose-400" : "text-zinc-300"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {formatElapsed(order.created_at, nowMs)}
                          </span>
                        </div>

                        <div className="space-y-2.5 p-3.5">
                          {order.special_instructions && (
                            <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300">
                              Note: {order.special_instructions}
                            </p>
                          )}

                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-xl border p-3 ${
                                item.status === "ready"
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : item.status === "served"
                                  ? "border-zinc-800 bg-zinc-900/40 opacity-60"
                                  : item.status === "rejected"
                                  ? "border-rose-500/30 bg-rose-500/5 opacity-70"
                                  : "border-zinc-800 bg-[#131720]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p
                                    className={`text-sm font-semibold ${
                                      item.status === "served" || item.status === "rejected"
                                        ? "line-through text-zinc-500"
                                        : "text-white"
                                    }`}
                                  >
                                    <span className="mr-1.5 font-mono text-orange-400">
                                      {item.quantity}×
                                    </span>
                                    {item.item_name_snapshot}
                                    {item.variant_name_snapshot && (
                                      <span className="ml-1 text-xs font-normal text-zinc-400">
                                        ({item.variant_name_snapshot})
                                      </span>
                                    )}
                                  </p>
                                  {item.instructions && (
                                    <p className="mt-0.5 text-[11px] text-amber-300">
                                      {item.instructions}
                                    </p>
                                  )}
                                </div>
                                <StatusBadge status={item.status} variant="dark" compact />
                              </div>

                              {(item.status === "accepted" || item.status === "preparing") && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  {item.status === "accepted" && (
                                    <button
                                      type="button"
                                      disabled={busyId === item.id}
                                      onClick={() =>
                                        postAction(
                                          `/api/v1/chef/items/${item.id}/start`,
                                          undefined,
                                          item.id
                                        )
                                      }
                                      className="rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
                                    >
                                      Start Cooking
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busyId === item.id}
                                    onClick={() =>
                                      postAction(
                                        `/api/v1/chef/items/${item.id}/ready`,
                                        undefined,
                                        item.id
                                      )
                                    }
                                    className="flex-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                                  >
                                    Mark Ready → Notify Staff
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRejectTarget({
                                        kind: "item",
                                        id: item.id,
                                        label: `${item.item_name_snapshot} (#${order.order_number})`,
                                      })
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1.5 text-[11px] text-zinc-400 hover:border-rose-500/50 hover:text-rose-300"
                                    title="Reject single unavailable item"
                                  >
                                    86 Item
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {/* COLUMN 3: READY AT PASS (AWAITING WAITER PICKUP) */}
            <section className="flex flex-col rounded-2xl border border-emerald-500/25 bg-[#12151C]">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                    Ready at Pass · Waiter Pickup
                  </h2>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                  {ready.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {ready.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    Pass is clear. Items marked ready alert Floor Staff automatically.
                  </div>
                ) : (
                  ready.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-xl border border-emerald-500/35 bg-[#181C25] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-lg font-bold text-white">
                            #{order.order_number}
                          </span>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                            {order.table_number}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-emerald-400">
                          Waiter Notified
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between text-zinc-200"
                          >
                            <span
                              className={
                                item.status === "served" ? "line-through text-zinc-500" : ""
                              }
                            >
                              <span className="font-mono text-emerald-400">
                                {item.quantity}×
                              </span>{" "}
                              {item.item_name_snapshot}
                            </span>
                            <StatusBadge status={item.status} variant="dark" compact />
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* ==================== 86 / ITEM AVAILABILITY BOARD ==================== */}
        {tab === "availability" && (
          <div className="rounded-2xl border border-zinc-800 bg-[#12151C] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Live Dish Availability (86 Control)
                </h2>
                <p className="text-xs text-zinc-400">
                  Toggling a dish out-of-stock immediately updates customer QR menus across
                  all tables.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.menu_items ?? []).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${
                    item.is_available
                      ? "border-zinc-800 bg-[#181C25]"
                      : "border-rose-500/35 bg-rose-950/20"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Prep {item.prep_minutes}m ·{" "}
                      {item.is_available ? "In Stock" : "86'd (Unavailable)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => toggleAvailability(item)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      item.is_available
                        ? "bg-emerald-500/20 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300"
                        : "bg-rose-500 text-white hover:bg-emerald-500 hover:text-zinc-950"
                    }`}
                  >
                    {item.is_available ? "Available" : "Sold Out"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== REJECTED & KITCHEN HISTORY ==================== */}
        {tab === "history" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-[#12151C] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                Rejected Orders ({data?.rejected.length ?? 0})
              </h2>
              <div className="mt-3 space-y-2.5">
                {(data?.rejected ?? []).length === 0 ? (
                  <p className="text-xs text-zinc-500">No rejected orders today.</p>
                ) : (
                  data?.rejected.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-rose-500/25 bg-[#181C25] p-3.5 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-white">
                        <span>
                          #{o.order_number} · {o.table_number}
                        </span>
                        <span className="text-zinc-400">
                          {formatTimeShort(o.updated_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-rose-300">Reason: {o.rejection_reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-[#12151C] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                Completed &amp; Served Kitchen Tickets ({data?.history.length ?? 0})
              </h2>
              <div className="mt-3 space-y-2.5">
                {(data?.history ?? []).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#181C25] p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        #{o.order_number} · {o.table_number}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        {o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(", ")}
                      </p>
                    </div>
                    <StatusBadge status={o.status} variant="dark" compact />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* REJECTION REASON MODAL */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#151921] p-6 text-zinc-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Capture Rejection Reason
                </p>
                <h3 className="mt-1 text-base font-bold text-white">
                  {rejectTarget.label}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Both the customer and manager are notified immediately with this reason.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRejectReason(r);
                    setCustomRejectReason("");
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                    rejectReason === r && !customRejectReason
                      ? "border-rose-500 bg-rose-500/15 text-rose-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  {r}
                  {rejectReason === r && !customRejectReason && (
                    <Check className="h-3.5 w-3.5 text-rose-400" />
                  )}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={customRejectReason}
              onChange={(e) => setCustomRejectReason(e.target.value)}
              placeholder="Or type a custom kitchen explanation..."
              className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
            />

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChefPage() {
  return (
    <RoleAuthGate requiredRoles={["chef", "owner"]} preferredRole="chef" theme="dark">
      {({ user, logout }) => <ChefWorkspace user={user} logout={logout} />}
    </RoleAuthGate>
  );
}
