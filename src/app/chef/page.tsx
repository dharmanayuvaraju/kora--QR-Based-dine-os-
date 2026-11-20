"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Flame,
  History,
  Package,
  Utensils,
  X,
} from "lucide-react";
import { RoleAuthGate } from "@/components/RoleAuthGate";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { notifyLocalTabs, useRealtime } from "@/hooks/useRealtime";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { playChime } from "@/lib/sound";
import { formatElapsed, formatTimeShort } from "@/lib/utils";
import {
  REJECTION_REASONS,
  type InventoryItem,
  type LowStockFlag,
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
  low_stock_flags?: LowStockFlag[];
}

function ChefWorkspace({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const { reducedMotion } = useMotionPreference();
  const [data, setData] = useState<ChefPayload | null>(null);
  const [tab, setTab] = useState<"kds" | "availability" | "history">("kds");
  const [muted, setMuted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [freshTicketIds, setFreshTicketIds] = useState<Set<string>>(new Set());
  const seenPendingIdsRef = useRef<Set<string>>(new Set());

  // Low-Stock Flag Modal
  const [flagTarget, setFlagTarget] = useState<MenuItem | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [submittingFlag, setSubmittingFlag] = useState(false);

  // Reject Order / Item Modal
  const [rejectTarget, setRejectTarget] = useState<{
    kind: "order" | "item";
    id: string;
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [customRejectReason, setCustomRejectReason] = useState("");

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/v1/chef/orders?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as ChefPayload;
      const incomingIds = next.pending.map((o) => o.id);
      if (seenPendingIdsRef.current.size > 0) {
        const newlyAdded = incomingIds.filter((id) => !seenPendingIdsRef.current.has(id));
        if (newlyAdded.length > 0) {
          setFreshTicketIds((prev) => new Set([...prev, ...newlyAdded]));
          setTimeout(() => {
            setFreshTicketIds((prev) => {
              const copy = new Set(prev);
              newlyAdded.forEach((id) => copy.delete(id));
              return copy;
            });
          }, 2600);
        }
      }
      incomingIds.forEach((id) => seenPendingIdsRef.current.add(id));
      setData(next);
    }
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
    } else if (ev.type === "menu.updated" || ev.type === "inventory.updated") {
      setBanner(ev.message);
      setTimeout(() => setBanner((prev) => (prev === ev.message ? null : prev)), 4000);
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
      notifyLocalTabs({
        type: "menu.updated",
        message: `${item.name} availability updated by Kitchen`,
      });
      await fetchOrders();
    } finally {
      setBusyId(null);
    }
  };

  const submitLowStockFlag = async () => {
    if (!flagTarget) return;
    setSubmittingFlag(true);
    try {
      const res = await fetch("/api/v1/chef/low-stock-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_item_id: flagTarget.id,
          note: flagNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner(json.error ?? "Could not submit low-stock flag");
      } else {
        setBanner(`Flagged low stock for ${flagTarget.name}. Manager and Owner alerted.`);
        notifyLocalTabs({
          type: "inventory.updated",
          message: `Chef flagged low stock: ${flagTarget.name}`,
        });
        setFlagTarget(null);
        setFlagNote("");
        await fetchOrders();
      }
    } finally {
      setSubmittingFlag(false);
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
    <div className="min-h-screen bg-[#F6F7F8] pb-20 text-stone-900 lg:pb-0">
      <ConsoleHeader
        user={user}
        connected={connected}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onLogout={logout}
        subtitle="Kitchen Display System"
      />

      {/* KDS Sub-toolbar */}
      <div className="border-b border-stone-200 bg-white shadow-2xs">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab("kds")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                tab === "kds"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <Flame className="h-3.5 w-3.5" strokeWidth={1.65} />
              Live KDS Board
              <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${tab === "kds" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"}`}>
                {pending.length + preparing.length + ready.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("availability")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                tab === "availability"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <Utensils className="h-3.5 w-3.5" strokeWidth={1.65} />
              86 / Item Availability
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                tab === "history"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <History className="h-3.5 w-3.5" strokeWidth={1.65} />
              Rejected &amp; History ({(data?.rejected.length ?? 0) + (data?.history.length ?? 0)})
            </button>
          </div>

          {(data?.inventory_low.length ?? 0) > 0 && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800">
              <Package className="h-3.5 w-3.5" strokeWidth={1.65} />
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
          <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 shadow-2xs">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)}>
              <X className="h-4 w-4" strokeWidth={1.65} />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        {/* ==================== 3-COLUMN LIVE KDS ==================== */}
        {tab === "kds" && (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* COLUMN 1: NEW ORDERS (APPROVAL AUTHORITY) */}
            <section className="flex flex-col rounded-2xl border border-amber-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/60 px-4 py-3 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900">
                    New Orders · Approval
                  </h2>
                </div>
                <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                  {pending.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {pending.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                    All incoming orders reviewed. Waiting for next table order...
                  </div>
                ) : (
                  pending.map((order) => {
                    const isFresh = freshTicketIds.has(order.id);
                    return (
                    <article
                      key={order.id}
                      className={`overflow-hidden rounded-xl border bg-white shadow-xs ${
                        !reducedMotion ? "kora-ticket-enter" : ""
                      } ${
                        isFresh && !reducedMotion
                          ? "border-amber-400 ring-2 ring-amber-400/35"
                          : "border-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-stone-100 bg-amber-50/40 px-4 py-2.5">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-lg font-bold text-stone-900">
                            #{order.order_number}
                          </span>
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-800">
                            {order.table_number}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-amber-800">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.65} />
                          {formatElapsed(order.created_at, nowMs)}
                        </span>
                      </div>

                      <div className="p-4">
                        {order.special_instructions && (
                          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.65} />
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
                                <p className="font-semibold text-stone-900">
                                  <span className="mr-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-800">
                                    {item.quantity}×
                                  </span>
                                  {item.item_name_snapshot}
                                  {item.variant_name_snapshot && (
                                    <span className="ml-1.5 text-xs font-normal text-stone-500">
                                      ({item.variant_name_snapshot})
                                    </span>
                                  )}
                                </p>
                                {item.addons.length > 0 && (
                                  <p className="mt-0.5 pl-7 text-xs text-stone-500">
                                    + {item.addons.map((a) => a.addon_name_snapshot).join(", ")}
                                  </p>
                                )}
                                {item.instructions && (
                                  <p className="mt-0.5 pl-7 text-xs font-medium text-amber-800">
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
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" strokeWidth={1.65} /> Reject
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() =>
                              postAction(`/api/v1/chef/orders/${order.id}/accept`, undefined, order.id)
                            }
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-2xs"
                          >
                            <Check className="h-4 w-4" strokeWidth={1.65} /> Accept Order
                          </button>
                        </div>
                      </div>
                    </article>
                    );
                  })
                )}
              </div>
            </section>

            {/* COLUMN 2: PREPARING (ITEM-LEVEL INDEPENDENT CONTROLS) */}
            <section className="flex flex-col rounded-2xl border border-orange-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50/60 px-4 py-3 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" strokeWidth={1.65} />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-orange-900">
                    Preparing · Item Control
                  </h2>
                </div>
                <span className="rounded-md bg-orange-100 px-2 py-0.5 font-mono text-xs font-bold text-orange-800">
                  {preparing.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {preparing.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
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
                        className={`overflow-hidden rounded-xl border bg-white shadow-xs ${
                          urgent ? "border-rose-400 ring-1 ring-rose-300" : "border-stone-200"
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-lg font-bold text-stone-900">
                              #{order.order_number}
                            </span>
                            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">
                              {order.table_number}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                              urgent ? "text-rose-600" : "text-stone-600"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.65} />
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
                                  ? "border-emerald-200 bg-emerald-50/50"
                                  : item.status === "served"
                                  ? "border-stone-200 bg-stone-50/60 opacity-60"
                                  : item.status === "rejected"
                                  ? "border-rose-200 bg-rose-50/50 opacity-70"
                                  : "border-stone-200 bg-stone-50/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p
                                    className={`text-sm font-semibold ${
                                      item.status === "served" || item.status === "rejected"
                                        ? "line-through text-stone-400" : "text-stone-900"
                                    }`}
                                  >
                                    <span className="mr-1.5 font-mono text-[#C2410C]">
                                      {item.quantity}×
                                    </span>
                                    {item.item_name_snapshot}
                                    {item.variant_name_snapshot && (
                                      <span className="ml-1 text-xs font-normal text-stone-500">
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
                                <StatusBadge status={item.status} compact />
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
                                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-2xs"
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
                                    className="rounded-lg border border-stone-200 px-2 py-1.5 text-[11px] text-stone-600 hover:border-rose-300 hover:text-rose-700"
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
            <section className="flex flex-col rounded-2xl border border-emerald-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/60 px-4 py-3 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.65} />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900">
                    Ready at Pass · Waiter Pickup
                  </h2>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                  {ready.length}
                </span>
              </div>

              <div className="space-y-3.5 p-3.5">
                {ready.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">Pass is clear. Items marked ready alert Floor Staff automatically.</div>
                ) : (
                  ready.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-lg font-bold text-white">
                            #{order.order_number}
                          </span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                            {order.table_number}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700">Waiter Notified</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between text-stone-800"
                          >
                            <span
                              className={
                                item.status === "served" ? "line-through text-stone-400" : ""
                              }
                            >
                              <span className="font-mono font-semibold text-emerald-700">
                                {item.quantity}×
                              </span>{" "}
                              {item.item_name_snapshot}
                            </span>
                            <StatusBadge status={item.status} compact />
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
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Live Dish Availability (86 Control)
                </h2>
                <p className="text-xs text-stone-500">
                  Toggling a dish out-of-stock immediately updates customer QR menus across
                  all tables.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.menu_items ?? []).map((item) => {
                const isOut =
                  !item.is_available ||
                  (typeof item.stock_count === "number" && item.stock_count <= 0);
                const hasOpenFlag = (data?.low_stock_flags ?? []).some(
                  (f) => f.menu_item_id === item.id && f.status === "open"
                );
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 ${
                      !isOut ? "border-stone-200 bg-white shadow-2xs" : "border-rose-200 bg-rose-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          Prep {item.prep_minutes}m · Stock:{" "}
                          <span className="font-mono font-semibold text-stone-800">
                            {item.stock_count ?? 0}
                          </span>{" "}
                          · {!isOut ? "In Stock" : "86'd (Sold Out)"}
                        </p>
                      </div>
                      {hasOpenFlag && (
                        <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Low Flagged
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFlagTarget(item);
                          setFlagNote("");
                        }}
                        className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        <Flag className="h-3.5 w-3.5" strokeWidth={1.7} />
                        Flag low stock
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => toggleAvailability(item)}
                        className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          !isOut ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300" : "bg-rose-600 text-white hover:bg-emerald-600"
                        }`}
                      >
                        {!isOut ? "Available" : "Sold Out"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== REJECTED & KITCHEN HISTORY ==================== */}
        {tab === "history" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700">
                Rejected Orders ({data?.rejected.length ?? 0})
              </h2>
              <div className="mt-3 space-y-2.5">
                {(data?.rejected ?? []).length === 0 ? (
                  <p className="text-xs text-stone-500">No rejected orders today.</p>
                ) : (
                  data?.rejected.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-stone-900">
                        <span>
                          #{o.order_number} · {o.table_number}
                        </span>
                        <span className="text-stone-500">
                          {formatTimeShort(o.updated_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-rose-700">Reason: {o.rejection_reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
                Completed &amp; Served Kitchen Tickets ({data?.history.length ?? 0})
              </h2>
              <div className="mt-3 space-y-2.5">
                {(data?.history ?? []).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-stone-900">
                        #{o.order_number} · {o.table_number}
                      </p>
                      <p className="mt-0.5 text-stone-500">
                        {o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(", ")}
                      </p>
                      {o.status === "cancelled" && o.cancellation_reason && (
                        <p className="mt-0.5 text-xs font-medium text-rose-700">Cancelled: {o.cancellation_reason}</p>
                      )}
                    </div>
                    <StatusBadge status={o.status} compact />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* LOW-STOCK FLAG MODAL */}
      {flagTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Flag Low Stock to Management
                </p>
                <h3 className="mt-1 text-base font-bold text-stone-900">
                  {flagTarget.name}
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Current stock count: <span className="font-mono font-semibold text-stone-800">{flagTarget.stock_count ?? 0}</span>. Owner and Manager receive an instant alert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFlagTarget(null)}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.65} />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-stone-700">
                Optional kitchen note
              </label>
              <input
                type="text"
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="e.g. Only 3 portions left for dinner rush"
                className="mt-1.5 min-h-[42px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 outline-none focus:border-amber-500"
              />
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setFlagTarget(null)}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingFlag}
                onClick={submitLowStockFlag}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 shadow-2xs"
              >
                {submittingFlag ? "Sending..." : "Send Low-Stock Flag"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Capture Rejection Reason
                </p>
                <h3 className="mt-1 text-base font-bold text-stone-900">
                  {rejectTarget.label}
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Both the customer and manager are notified immediately with this reason.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" strokeWidth={1.65} />
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
                    rejectReason === r && !customRejectReason ? "border-rose-300 bg-rose-50 text-rose-800" : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {r}
                  {rejectReason === r && !customRejectReason && (
                    <Check className="h-3.5 w-3.5 text-rose-400" strokeWidth={1.65} />
                  )}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={customRejectReason}
              onChange={(e) => setCustomRejectReason(e.target.value)}
              placeholder="Or type a custom kitchen explanation..."
              className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 outline-none focus:border-rose-500"
            />

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-2xs"
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
    <RoleAuthGate requiredRoles={["chef"]} preferredRole="chef">
      {({ user, logout }) => <ChefWorkspace user={user} logout={logout} />}
    </RoleAuthGate>
  );
}
