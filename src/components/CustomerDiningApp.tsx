"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Flame,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { DietaryMark } from "@/components/DietaryMark";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatTimeShort } from "@/lib/utils";
import { playChime } from "@/lib/sound";
import type {
  MenuCategory,
  MenuItem,
  Order,
  RestaurantSettings,
  RestaurantTable,
  SessionBillSummary,
  TableSession,
} from "@/lib/types";

interface CartEntry {
  key: string;
  menu_item: MenuItem;
  variant_id: string | null;
  variant_name: string | null;
  addon_ids: string[];
  addon_names: string[];
  unit_price: number;
  quantity: number;
  instructions: string;
}

export function CustomerDiningApp({ qrToken }: { qrToken: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [bill, setBill] = useState<SessionBillSummary | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "bill">("menu");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dietFilter, setDietFilter] = useState<"all" | "veg" | "non_veg" | "vegan" | "bestseller">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart & Customization Modal
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selVariantId, setSelVariantId] = useState<string | null>(null);
  const [selAddonIds, setSelAddonIds] = useState<string[]>([]);
  const [selNote, setSelNote] = useState("");
  const [selQty, setSelQty] = useState(1);

  const [cartOpen, setCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "warn" | "err" } | null>(null);

  // Payment Modal State (Demo simulated checkout)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payChannel, setPayChannel] = useState<"upi" | "card">("upi");
  const [payAmountInput, setPayAmountInput] = useState("");
  const [upiId, setUpiId] = useState("guest@okaxis");
  const [processingPay, setProcessingPay] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const showToast = useCallback((text: string, tone: "ok" | "warn" | "err" = "ok") => {
    setToast({ text, tone });
    setTimeout(() => setToast((prev) => (prev?.text === text ? null : prev)), 4500);
  }, []);

  const refreshMenuOnly = useCallback(async () => {
    try {
      const menuRes = await fetch(`/api/v1/public/menu?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setCategories(menuData.categories ?? []);
        setItems(menuData.items ?? []);
        if (menuData.settings) setSettings(menuData.settings);
      }
    } catch {
      // ignore transient error
    }
  }, []);

  const loadTableAndMenu = useCallback(
    async (forceNew = false) => {
      try {
        const storageKey = `kora_last_session_${qrToken}`;
        let savedSessionId: string | null = null;
        if (typeof window !== "undefined") {
          if (forceNew) {
            window.sessionStorage.removeItem(storageKey);
          } else {
            savedSessionId = window.sessionStorage.getItem(storageKey);
          }
        }
        const query = forceNew
          ? "?new=1"
          : savedSessionId
          ? `?session_id=${encodeURIComponent(savedSessionId)}`
          : "";

        const [tableRes, menuRes] = await Promise.all([
          fetch(`/api/v1/public/tables/${qrToken}${query}`, { cache: "no-store" }),
          fetch(`/api/v1/public/menu?t=${Date.now()}`, { cache: "no-store" }),
        ]);
        const tableData = await tableRes.json();
        if (!tableRes.ok) {
          setError(tableData.error ?? "Invalid QR code");
          setLoading(false);
          return;
        }
        const menuData = await menuRes.json();
        setTable(tableData.table);
        setSession(tableData.session);
        setBill(tableData.bill);
        setSettings(tableData.settings);
        setCategories(menuData.categories ?? []);
        setItems(menuData.items ?? []);
        if (typeof window !== "undefined" && tableData.session?.id) {
          window.sessionStorage.setItem(storageKey, tableData.session.id);
        }
        setError(null);
      } catch {
        setError("Could not connect to restaurant ordering service.");
      } finally {
        setLoading(false);
      }
    },
    [qrToken]
  );

  const refreshSessionBill = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/v1/public/sessions/${sessionId}/orders?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setBill(data.bill);
        setSession((prev) =>
          prev ? { ...prev, status: data.bill.session_status } : prev
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTableAndMenu(false);
  }, [loadTableAndMenu]);

  const { connected } = useRealtime((event) => {
    if (event.type === "menu.updated") {
      refreshMenuOnly();
      return;
    }
    if (session && event.session_id === session.id) {
      refreshSessionBill(session.id);
      if (event.type === "order.accepted") {
        playChime("payment_success");
        showToast(`Order #${event.order_number} accepted by Chef!`, "ok");
      } else if (event.type === "order.rejected") {
        playChime("alert");
        showToast(event.message, "err");
      } else if (event.type === "item.ready") {
        playChime("item_ready");
        showToast("Your dish is ready — staff is bringing it to your table!", "ok");
      } else if (event.type === "payment.completed") {
        playChime("payment_success");
        showToast("Payment confirmed! Thank you for dining with us.", "ok");
      } else if (event.type === "session.closed") {
        showToast("Table session closed. Your paid GST invoice is saved below.", "ok");
      }
    }
  });

  const openCustomize = (item: MenuItem) => {
    if (!item.is_available) return;
    setCustomizingItem(item);
    const defaultVar = item.variants.find((v) => v.is_default) ?? item.variants[0] ?? null;
    setSelVariantId(defaultVar?.id ?? null);
    setSelAddonIds([]);
    setSelNote("");
    setSelQty(1);
  };

  const addCustomizedToCart = () => {
    if (!customizingItem) return;
    const variant = customizingItem.variants.find((v) => v.id === selVariantId) ?? null;
    const addons = customizingItem.addons.filter((a) => selAddonIds.includes(a.id));
    const unitPrice =
      customizingItem.price +
      (variant?.price_delta ?? 0) +
      addons.reduce((s, a) => s + a.price, 0);
    const key = `${customizingItem.id}|${variant?.id ?? ""}|${addons
      .map((a) => a.id)
      .sort()
      .join(",")}|${selNote.trim()}`;

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + selQty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          menu_item: customizingItem,
          variant_id: variant?.id ?? null,
          variant_name: variant?.name ?? null,
          addon_ids: addons.map((a) => a.id),
          addon_names: addons.map((a) => a.name),
          unit_price: unitPrice,
          quantity: selQty,
          instructions: selNote.trim(),
        },
      ];
    });
    setCustomizingItem(null);
    showToast(`Added ${selQty}× ${customizingItem.name} to tray`, "ok");
  };

  const quickAdd = (item: MenuItem) => {
    if (!item.is_available) return;
    if (item.variants.length > 0 || item.addons.length > 0) {
      openCustomize(item);
      return;
    }
    const key = `${item.id}|||`;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          menu_item: item,
          variant_id: null,
          variant_name: null,
          addon_ids: [],
          addon_names: [],
          unit_price: item.price,
          quantity: 1,
          instructions: "",
        },
      ];
    });
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const cartSummary = useMemo(() => {
    const count = cart.reduce((s, c) => s + c.quantity, 0);
    const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
    const taxRate = settings?.tax_rate_percent ?? 5;
    const tax = Math.round(subtotal * taxRate) / 100;
    return { count, subtotal, tax, total: subtotal + tax };
  }, [cart, settings]);

  const placeOrder = async () => {
    if (!session || cart.length === 0) return;
    setPlacingOrder(true);
    try {
      const res = await fetch(`/api/v1/public/sessions/${session.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({
            menu_item_id: c.menu_item.id,
            variant_id: c.variant_id,
            addon_ids: c.addon_ids,
            quantity: c.quantity,
            instructions: c.instructions || null,
          })),
          special_instructions: orderNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to place order", "err");
        return;
      }
      setBill(data.bill);
      setCart([]);
      setOrderNote("");
      setCartOpen(false);
      setActiveTab("orders");
      playChime("new_order");
      showToast(
        `Order #${data.order.order_number} sent to Kitchen for Chef approval!`,
        "ok"
      );
    } catch {
      showToast("Network error while placing order.", "err");
    } finally {
      setPlacingOrder(false);
    }
  };

  const resubmitRejectedOrder = (rejectedOrder: Order) => {
    const reloaded: CartEntry[] = [];
    for (const oi of rejectedOrder.items) {
      const menuItem = items.find((m) => m.id === oi.menu_item_id && m.is_available);
      if (!menuItem) continue;
      reloaded.push({
        key: `${menuItem.id}|||resubmit-${oi.id}`,
        menu_item: menuItem,
        variant_id: null,
        variant_name: oi.variant_name_snapshot,
        addon_ids: [],
        addon_names: oi.addons.map((a) => a.addon_name_snapshot),
        unit_price: menuItem.price,
        quantity: oi.quantity,
        instructions: oi.instructions ?? "",
      });
    }
    if (reloaded.length === 0) {
      showToast("Items from that order are currently sold out.", "warn");
      return;
    }
    setCart(reloaded);
    setCartOpen(true);
  };

  const requestCounterBill = async () => {
    if (!session) return;
    const res = await fetch(`/api/v1/public/sessions/${session.id}/bill-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "counter" }),
    });
    const data = await res.json();
    if (res.ok) {
      setBill(data.bill);
      showToast("Bill requested! Staff has been alerted to assist at your table / counter.", "ok");
    } else {
      showToast(data.error ?? "Unable to request bill", "err");
    }
  };

  const openOnlineCheckout = () => {
    if (!bill) return;
    setPayAmountInput(String(bill.balance_due));
    setPayModalOpen(true);
  };

  const executeOnlinePayment = async () => {
    if (!session || !bill) return;
    const parsedAmt = Number(payAmountInput);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      showToast("Enter a valid amount to pay.", "err");
      return;
    }
    setProcessingPay(true);
    try {
      const createRes = await fetch("/api/v1/payments/online/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          amount: Math.min(parsedAmt, bill.balance_due),
          channel: payChannel,
          idempotency_key: `web-${session.id}-${Date.now()}`,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        showToast(createData.error ?? "Payment initiation failed", "err");
        return;
      }

      // Brief simulated payment processing delay
      await new Promise((r) => setTimeout(r, 600));

      const verifyRes = await fetch("/api/v1/payments/online/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: createData.payment.id,
          gateway_order_id: createData.gateway_order_id,
          gateway_payment_id:
            createData.sandbox_challenge?.gateway_payment_id ?? "pay_demo",
          gateway_signature:
            createData.sandbox_challenge?.gateway_signature ?? "sig_demo",
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        showToast(verifyData.error ?? "Payment confirmation failed", "err");
        return;
      }
      setBill(verifyData.bill);
      setSession((prev) =>
        prev ? { ...prev, status: verifyData.bill.session_status } : prev
      );
      setPayModalOpen(false);
      playChime("payment_success");
      showToast(
        `Demo payment recorded: ${formatCurrency(verifyData.payment.amount)} (${verifyData.payment.receipt_number})`,
        "ok"
      );
      if (verifyData.bill.balance_due <= 0.01) {
        setActiveTab("bill");
        setReceiptOpen(true);
      }
    } finally {
      setProcessingPay(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== "all" && item.category_id !== selectedCategory) return false;
      if (dietFilter === "veg" && item.dietary !== "veg" && item.dietary !== "vegan") return false;
      if (dietFilter === "non_veg" && item.dietary !== "non_veg") return false;
      if (dietFilter === "vegan" && item.dietary !== "vegan") return false;
      if (dietFilter === "bestseller" && !item.is_bestseller) return false;
      if (
        searchQuery.trim() &&
        !`${item.name} ${item.description}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [items, selectedCategory, dietFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] p-6 text-stone-600">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C2410C] text-white">
          <UtensilsCrossed className="h-5 w-5 animate-pulse" />
        </div>
        <p className="mt-4 font-serif text-lg text-stone-900">Preparing your table menu...</p>
        <p className="mt-1 text-xs text-stone-500">Validating secure table QR session</p>
      </div>
    );
  }

  if (error || !table || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-7 shadow-xs">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-3 font-serif text-xl font-semibold text-stone-900">
            Invalid Table QR Code
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {error ?? "This table QR has been deactivated or regenerated."}
          </p>
          <Link
            href="/customer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Choose Active Table
          </Link>
        </div>
      </div>
    );
  }

  const sessionClosed = bill?.session_status === "closed";
  const activeOrdersCount = (bill?.orders ?? []).filter(
    (o) => !["rejected", "cancelled"].includes(o.status)
  ).length;
  const hasPreparingItems = (bill?.orders ?? []).some((o) =>
    o.items.some((i) => i.status === "pending_approval" || i.status === "accepted" || i.status === "preparing")
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-28 text-[#1C1917]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-md">
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-lg ${
              toast.tone === "err"
                ? "border-rose-200 bg-rose-950 text-rose-50"
                : toast.tone === "warn"
                ? "border-amber-300 bg-amber-950 text-amber-50"
                : "border-stone-800 bg-[#1C1917] text-stone-50"
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)}>
              <X className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      )}

      {/* Editorial Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-[#E8E1D6] bg-[#FAF7F2]/95 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 pt-3.5 pb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Link
                href="/customer"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C2410C] text-white"
                title="Switch Table"
              >
                <UtensilsCrossed className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-lg font-semibold leading-none">
                    {settings?.name ?? "KORA"}
                  </h1>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    title={connected ? "Live updates active" : "Reconnecting"}
                  />
                </div>
                <p className="mt-1 text-xs font-medium text-stone-600">
                  <span className="font-semibold text-stone-900">{table.table_number}</span>
                  {" · "}
                  {table.section}
                  {" · "}
                  <span className="text-emerald-700">
                    {sessionClosed ? "Session Closed" : "Session Active"}
                  </span>
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
            >
              Hub
            </Link>
          </div>

          {/* 3-Tab Navigation */}
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#EFE9E0] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("menu")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                activeTab === "menu"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Digital Menu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                activeTab === "orders"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <span>Orders</span>
              {activeOrdersCount > 0 && (
                <span className="rounded-full bg-[#C2410C] px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {activeOrdersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bill")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                activeTab === "bill"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <span>Bill</span>
              {bill && bill.balance_due > 0 && (
                <span className="font-mono text-[11px] text-[#C2410C]">
                  {formatCurrency(bill.balance_due)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5">
        {sessionClosed && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" />
                  Bill Settled &amp; Table Session Closed
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  Thank you for dining at {settings?.name}. You can view your GST receipt or
                  start a fresh dining session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="shrink-0 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Receipt
              </button>
            </div>
            <button
              type="button"
              onClick={() => loadTableAndMenu(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 underline"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Start New Table Session
            </button>
          </div>
        )}

        {/* ==================== MENU TAB ==================== */}
        {activeTab === "menu" && (
          <div>
            {/* Search & Dietary Filters */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search biryanis, kebabs, naan, drinks..."
                className="w-full rounded-xl border border-[#E5DDD2] bg-white py-2.5 pr-4 pl-10 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#C2410C]"
              />
            </div>

            <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {(
                [
                  { id: "all", label: "All Dishes" },
                  { id: "bestseller", label: "Chef's Picks" },
                  { id: "veg", label: "Pure Veg" },
                  { id: "non_veg", label: "Non-Veg" },
                  { id: "vegan", label: "Plant-Based" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDietFilter(f.id)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    dietFilter === f.id
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-[#E5DDD2] bg-white text-stone-700 hover:border-stone-400"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Category Jump Ribbon */}
            <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto border-b border-[#E8E1D6] pb-3">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === "all"
                    ? "bg-[#C2410C] text-white"
                    : "bg-[#EFE9E0]/70 text-stone-700 hover:bg-[#EFE9E0]"
                }`}
              >
                Full Menu
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedCategory === cat.id
                      ? "bg-[#C2410C] text-white"
                      : "bg-[#EFE9E0]/70 text-stone-700 hover:bg-[#EFE9E0]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Dish List Grouped by Category */}
            <div className="mt-5 space-y-7">
              {categories
                .filter((c) => selectedCategory === "all" || c.id === selectedCategory)
                .map((cat) => {
                  const catItems = filteredItems.filter((i) => i.category_id === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <section key={cat.id}>
                      <div className="mb-3 flex items-baseline justify-between">
                        <div>
                          <h2 className="font-serif text-xl font-semibold text-stone-900">
                            {cat.name}
                          </h2>
                          <p className="text-xs text-stone-500">{cat.description}</p>
                        </div>
                        <span className="font-mono text-xs text-stone-400">
                          {catItems.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {catItems.map((item) => {
                          const qtyInCart = cart
                            .filter((c) => c.menu_item.id === item.id)
                            .reduce((s, c) => s + c.quantity, 0);

                          return (
                            <article
                              key={item.id}
                              className={`flex gap-3.5 rounded-2xl border border-[#EAE2D7] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] transition ${
                                !item.is_available ? "opacity-60 grayscale-[35%]" : ""
                              }`}
                            >
                              <div className="flex flex-1 flex-col justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <DietaryMark dietary={item.dietary} />
                                    {item.is_bestseller && (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                        <Sparkles className="h-2.5 w-2.5" /> Chef&apos;s Pick
                                      </span>
                                    )}
                                    {item.spice_level >= 2 && (
                                      <span
                                        className="inline-flex items-center text-orange-600"
                                        title={`Spice level ${item.spice_level}/3`}
                                      >
                                        {Array.from({ length: item.spice_level }).map((_, idx) => (
                                          <Flame key={idx} className="h-3 w-3 fill-orange-500" />
                                        ))}
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="mt-1.5 font-serif text-base font-semibold leading-snug text-stone-900">
                                    {item.name}
                                  </h3>
                                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500">
                                    {item.description}
                                  </p>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-sm font-semibold tabular-nums text-stone-900">
                                      {formatCurrency(item.price)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                                      <Clock className="h-3 w-3" /> {item.prep_minutes}m
                                    </span>
                                  </div>

                                  {!item.is_available ? (
                                    <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                                      Sold Out
                                    </span>
                                  ) : sessionClosed ? (
                                    <span className="text-[11px] text-stone-400">Closed</span>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      {(item.variants.length > 0 || item.addons.length > 0) && (
                                        <button
                                          type="button"
                                          onClick={() => openCustomize(item)}
                                          className="rounded-lg border border-stone-200 px-2 py-1.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                                        >
                                          Customize
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => quickAdd(item)}
                                        className="inline-flex items-center gap-1 rounded-xl bg-[#1C1917] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#C2410C]"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add{qtyInCart > 0 ? ` (${qtyInCart})` : ""}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-28 sm:w-28">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          </div>
        )}

        {/* ==================== LIVE ORDER TRACKING TAB ==================== */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-stone-900">
                  {sessionClosed ? "Completed Visit Orders" : "Live Table Orders"}
                </h2>
                <p className="text-xs text-stone-500">
                  {sessionClosed
                    ? "Your session is settled. All ordered items and your GST receipt remain visible."
                    : "All orders in this session update live per dish — no refresh needed."}
                </p>
              </div>
              {!sessionClosed ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("menu")}
                  className="rounded-xl bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  + Order More
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("bill")}
                  className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  View Paid Invoice
                </button>
              )}
            </div>

            {(bill?.orders ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
                <UtensilsCrossed className="mx-auto h-8 w-8 text-stone-300" />
                <p className="mt-3 text-sm font-semibold text-stone-700">
                  No orders placed yet for {table.table_number}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Browse the menu and send your first order to the kitchen.
                </p>
              </div>
            ) : (
              (bill?.orders ?? []).map((order) => {
                const steps = [
                  { id: "pending_approval", label: "Sent" },
                  { id: "accepted", label: "Chef Approved" },
                  { id: "preparing", label: "Cooking" },
                  { id: "served", label: "Served" },
                ];
                const rankMap: Record<string, number> = {
                  pending_approval: 0,
                  accepted: 1,
                  preparing: 2,
                  ready: 2.5,
                  served: 3,
                  completed: 3,
                };
                const currentRank = rankMap[order.status] ?? -1;

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-[#E8E1D6] bg-white p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-stone-900">
                            Order #{order.order_number}
                          </span>
                          <span className="text-xs text-stone-400">
                            · {formatTimeShort(order.created_at)}
                          </span>
                        </div>
                        {order.special_instructions && (
                          <p className="mt-1 text-xs text-amber-800">
                            Note: &ldquo;{order.special_instructions}&rdquo;
                          </p>
                        )}
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    {/* Progress Stepper (when not rejected/cancelled) */}
                    {currentRank >= 0 && (
                      <div className="my-3.5 grid grid-cols-4 gap-1.5">
                        {steps.map((step, idx) => {
                          const done = currentRank >= idx;
                          return (
                            <div key={step.id} className="space-y-1">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  done ? "bg-[#C2410C]" : "bg-stone-200"
                                }`}
                              />
                              <p
                                className={`text-[10px] font-medium ${
                                  done ? "text-stone-900" : "text-stone-400"
                                }`}
                              >
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Rejection Reason Banner */}
                    {order.status === "rejected" && (
                      <div className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                        <p className="font-semibold">
                          Kitchen could not accept this order: {order.rejection_reason}
                        </p>
                        <p className="mt-0.5 text-rose-700">
                          You have not been charged. Edit items and resubmit anytime.
                        </p>
                        <button
                          type="button"
                          onClick={() => resubmitRejectedOrder(order)}
                          className="mt-2 rounded-lg bg-rose-900 px-3 py-1.5 text-[11px] font-semibold text-white"
                        >
                          Edit &amp; Resubmit to Kitchen
                        </button>
                      </div>
                    )}

                    {/* Item-Level Live Status Breakdown */}
                    <div className="mt-2 divide-y divide-stone-100">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-900">
                              <span className="font-mono font-semibold text-[#C2410C]">
                                {item.quantity}×
                              </span>{" "}
                              {item.item_name_snapshot}
                              {item.variant_name_snapshot && (
                                <span className="ml-1 text-xs text-stone-500">
                                  ({item.variant_name_snapshot})
                                </span>
                              )}
                            </p>
                            {item.addons.length > 0 && (
                              <p className="text-[11px] text-stone-500">
                                + {item.addons.map((a) => a.addon_name_snapshot).join(", ")}
                              </p>
                            )}
                            {item.instructions && (
                              <p className="text-[11px] italic text-stone-500">
                                &ldquo;{item.instructions}&rdquo;
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge status={item.status} compact />
                            <span className="font-mono text-xs text-stone-500 tabular-nums">
                              {formatCurrency(item.item_total)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ==================== COMBINED TABLE BILL & PAYMENT TAB ==================== */}
        {activeTab === "bill" && bill && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E8E1D6] bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between border-b border-dashed border-stone-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                    Combined Session Bill
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-semibold text-stone-900">
                    {table.table_number} — Final Summary
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Includes all accepted orders placed during this visit
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    bill.payment_state === "paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : bill.payment_state === "partially_paid"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {bill.payment_state === "paid"
                    ? "Paid in Full"
                    : bill.payment_state === "partially_paid"
                    ? "Partially Paid"
                    : "Unpaid"}
                </span>
              </div>

              {hasPreparingItems && bill.balance_due > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  Some dishes in your session are still being prepared. You can settle now or
                  wait until all items are served.
                </div>
              )}

              {bill.line_items.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">
                  No billable dishes yet. Order from the Digital Menu first.
                </p>
              ) : (
                <>
                  <div className="mt-4 divide-y divide-stone-100 text-sm">
                    {bill.line_items.map((li, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium text-stone-900">
                            {li.item_name}{" "}
                            <span className="font-mono text-xs text-stone-500">
                              × {li.quantity}
                            </span>
                          </p>
                          <p className="text-[11px] text-stone-400">
                            Order #{li.order_number}
                            {li.variant_name ? ` · ${li.variant_name}` : ""}
                            {li.addons.length ? ` · +${li.addons.join(", ")}` : ""}
                          </p>
                        </div>
                        <span className="font-mono font-medium tabular-nums text-stone-900">
                          {formatCurrency(li.item_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-dashed border-stone-200 pt-4 text-sm">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(bill.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>GST ({bill.tax_rate_percent}%)</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(bill.tax_amount)}
                      </span>
                    </div>
                    {bill.service_charge > 0 && (
                      <div className="flex justify-between text-stone-600">
                        <span>Service Charge ({bill.service_charge_percent}%)</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(bill.service_charge)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
                      <span>Grand Total</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(bill.grand_total)}
                      </span>
                    </div>
                    {bill.amount_paid > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Amount Paid</span>
                        <span className="font-mono tabular-nums">
                          -{formatCurrency(bill.amount_paid)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between rounded-xl bg-stone-900 px-3.5 py-2.5 text-base font-semibold text-white">
                      <span>Balance Due</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(bill.balance_due)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Actions */}
                  {bill.balance_due > 0.01 && !sessionClosed ? (
                    <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={openOnlineCheckout}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#C2410C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9A3412]"
                      >
                        <Smartphone className="h-4 w-4" />
                        Demo Pay Online (UPI / Card)
                      </button>
                      <button
                        type="button"
                        onClick={requestCounterBill}
                        className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50"
                      >
                        <Store className="h-4 w-4" />
                        Pay at Counter
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {/* Inline Paid GST Tax Invoice kept permanently visible after payment */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 font-mono text-xs text-stone-800">
                        <div className="border-b border-dashed border-emerald-300 pb-2 text-center">
                          <p className="font-serif text-base font-bold text-stone-900">
                            {settings?.name}
                          </p>
                          <p className="text-[11px] text-stone-500">{settings?.address}</p>
                          <p className="text-[11px] text-stone-500">
                            GSTIN: {settings?.gstin}
                          </p>
                          <p className="mt-1.5 font-semibold text-emerald-800">
                            PAID GST TAX INVOICE · {table.table_number}
                          </p>
                        </div>
                        <div className="mt-2.5 space-y-1">
                          {bill.line_items.map((li, i) => (
                            <div key={i} className="flex justify-between gap-2">
                              <span>
                                {li.quantity}× {li.item_name}
                              </span>
                              <span>{formatCurrency(li.item_total)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 space-y-1 border-t border-dashed border-emerald-300 pt-2">
                          <div className="flex justify-between text-stone-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(bill.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-stone-600">
                            <span>CGST + SGST ({bill.tax_rate_percent}%)</span>
                            <span>{formatCurrency(bill.tax_amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold text-emerald-900">
                            <span>TOTAL PAID</span>
                            <span>{formatCurrency(bill.amount_paid)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReceiptOpen(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        <Receipt className="h-4 w-4" />
                        Print / Download GST Tax Receipt
                      </button>
                    </div>
                  )}

                  {bill.session_status === "payment_pending" && bill.balance_due > 0 && (
                    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                      <p className="font-semibold">Counter Bill Request Active</p>
                      <p className="mt-0.5">
                        Your waiter &amp; cashier have been notified for{" "}
                        <strong>{table.table_number}</strong>. You may pay at the counter or
                        complete online UPI payment above anytime.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Ledger for this session */}
            {bill.payments.length > 0 && (
              <div className="rounded-2xl border border-[#E8E1D6] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Recorded Payments
                </p>
                <div className="mt-2.5 space-y-2">
                  {bill.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-stone-900">
                          {p.receipt_number} · {p.method === "online" ? "Demo Online" : "Counter"} (
                          {p.channel.toUpperCase()})
                        </p>
                        <p className="text-stone-500">
                          {formatTimeShort(p.created_at)} · Status:{" "}
                          <span className="font-semibold uppercase">{p.status}</span>
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-stone-900">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Cart Bar */}
      {cartSummary.count > 0 && !sessionClosed && (
        <div className="fixed right-4 bottom-4 left-4 z-30 mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[#1C1917] px-5 py-3.5 text-white shadow-xl transition hover:bg-[#C2410C]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 font-mono text-xs font-bold">
                {cartSummary.count}
              </span>
              <div className="text-left">
                <p className="text-xs font-medium text-stone-300">Your Table Tray</p>
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(cartSummary.total)}{" "}
                  <span className="text-[11px] font-normal opacity-75">incl. GST</span>
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <ShoppingBag className="h-4 w-4" /> Review Order
            </span>
          </button>
        </div>
      )}

      {/* ==================== DISH CUSTOMIZATION MODAL ==================== */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DietaryMark dietary={customizingItem.dietary} showLabel />
                <h3 className="mt-1 font-serif text-xl font-semibold text-stone-900">
                  {customizingItem.name}
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  {customizingItem.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="rounded-full bg-stone-100 p-1.5 text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customizingItem.variants.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Choose Portion
                </p>
                <div className="mt-2 space-y-2">
                  {customizingItem.variants.map((v) => (
                    <label
                      key={v.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                        selVariantId === v.id
                          ? "border-[#C2410C] bg-orange-50/50"
                          : "border-stone-200"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name="variant"
                          checked={selVariantId === v.id}
                          onChange={() => setSelVariantId(v.id)}
                          className="accent-[#C2410C]"
                        />
                        {v.name}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {formatCurrency(customizingItem.price + v.price_delta)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {customizingItem.addons.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Optional Add-ons
                </p>
                <div className="mt-2 space-y-2">
                  {customizingItem.addons.map((a) => {
                    const checked = selAddonIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                          checked ? "border-[#C2410C] bg-orange-50/50" : "border-stone-200"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelAddonIds((prev) =>
                                checked ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                              )
                            }
                            className="accent-[#C2410C]"
                          />
                          {a.name}
                        </span>
                        <span className="font-mono text-xs text-stone-600">
                          +{formatCurrency(a.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Chef Instructions (Optional)
              </label>
              <input
                type="text"
                value={selNote}
                onChange={(e) => setSelNote(e.target.value)}
                placeholder="e.g. Less spicy, no onions, extra crisp"
                className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#C2410C]"
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => setSelQty((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-stone-600"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-mono text-sm font-semibold">
                  {selQty}
                </span>
                <button
                  type="button"
                  onClick={() => setSelQty((q) => q + 1)}
                  className="p-2.5 text-stone-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={addCustomizedToCart}
                className="flex-1 rounded-xl bg-[#C2410C] py-3 text-sm font-semibold text-white hover:bg-[#9A3412]"
              >
                Add to Tray ·{" "}
                {formatCurrency(
                  (customizingItem.price +
                    (customizingItem.variants.find((v) => v.id === selVariantId)
                      ?.price_delta ?? 0) +
                    customizingItem.addons
                      .filter((a) => selAddonIds.includes(a.id))
                      .reduce((s, a) => s + a.price, 0)) *
                    selQty
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CART REVIEW DRAWER ==================== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-semibold">
                  Review Order — {table.table_number}
                </h3>
                <p className="text-xs text-stone-500">
                  Sent directly to kitchen for Chef approval · Pay later
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-full bg-stone-100 p-1.5 text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 divide-y divide-stone-100">
              {cart.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">
                      {c.menu_item.name}
                    </p>
                    {(c.variant_name || c.addon_names.length > 0) && (
                      <p className="text-xs text-stone-500">
                        {[c.variant_name, ...c.addon_names].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {c.instructions && (
                      <p className="text-xs italic text-amber-800">&ldquo;{c.instructions}&rdquo;</p>
                    )}
                    <p className="mt-0.5 font-mono text-xs text-stone-600">
                      {formatCurrency(c.unit_price * c.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center rounded-lg border border-stone-200">
                    <button
                      type="button"
                      onClick={() => updateCartQty(c.key, -1)}
                      className="p-1.5 text-stone-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono text-xs font-semibold">
                      {c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(c.key, 1)}
                      className="p-1.5 text-stone-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-stone-600">
                Overall Table / Allergy Note
              </label>
              <input
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="e.g. Serve starters first, peanut allergy..."
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#C2410C]"
              />
            </div>

            <div className="mt-4 space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(cartSummary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>GST ({settings?.tax_rate_percent ?? 5}%)</span>
                <span className="font-mono">{formatCurrency(cartSummary.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-1.5 text-sm font-semibold text-stone-900">
                <span>Order Total</span>
                <span className="font-mono">{formatCurrency(cartSummary.total)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={placingOrder || cart.length === 0}
              onClick={placeOrder}
              className="mt-4 w-full rounded-xl bg-[#C2410C] py-3.5 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:opacity-60"
            >
              {placingOrder ? "Sending to Kitchen..." : "Place Order · Send to Chef"}
            </button>
          </div>
        </div>
      )}

      {/* ==================== DEMO SIMULATED ONLINE PAYMENT MODAL ==================== */}
      {payModalOpen && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-stone-100 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#C2410C]">
                  Demo Payment — Simulated, No Real Charge
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold text-stone-900">
                  {settings?.name} · {table.table_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="rounded-full bg-stone-100 p-1.5 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Demo payment — simulated, no real charge. Completing this form records a
              simulated payment and generates your GST invoice.
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-stone-600">
                Amount to Pay (Full or Partial Split)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-lg font-semibold text-stone-500">₹</span>
                <input
                  type="number"
                  min={1}
                  max={bill.balance_due}
                  step="0.01"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-base font-semibold outline-none focus:border-[#C2410C]"
                />
                <button
                  type="button"
                  onClick={() => setPayAmountInput(String(bill.balance_due))}
                  className="shrink-0 rounded-lg bg-stone-100 px-2.5 py-2 text-xs font-semibold text-stone-700"
                >
                  Full
                </button>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                Total balance due: {formatCurrency(bill.balance_due)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayChannel("upi")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold ${
                  payChannel === "upi"
                    ? "border-[#C2410C] bg-orange-50 text-[#9A3412]"
                    : "border-stone-200 text-stone-600"
                }`}
              >
                <Smartphone className="h-4 w-4" /> Simulated UPI
              </button>
              <button
                type="button"
                onClick={() => setPayChannel("card")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold ${
                  payChannel === "card"
                    ? "border-[#C2410C] bg-orange-50 text-[#9A3412]"
                    : "border-stone-200 text-stone-600"
                }`}
              >
                <CreditCard className="h-4 w-4" /> Simulated Card
              </button>
            </div>

            {payChannel === "upi" ? (
              <div className="mt-4">
                <label className="text-xs font-medium text-stone-600">
                  Demo UPI Handle
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                Simulated Test Card •••• 4242 · Exp 12/29 · No real card will be charged
              </div>
            )}

            <button
              type="button"
              disabled={processingPay}
              onClick={executeOnlinePayment}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C2410C] py-3 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {processingPay
                ? "Recording Demo Payment..."
                : `Confirm Demo Payment · ${formatCurrency(Number(payAmountInput) || 0)}`}
            </button>
          </div>
        </div>
      )}

      {/* ==================== PRINTABLE GST THERMAL RECEIPT ==================== */}
      {receiptOpen && bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 font-mono text-xs text-stone-800 shadow-2xl">
            <div className="text-center">
              <p className="font-serif text-lg font-bold text-stone-900">
                {settings?.name}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">{settings?.address}</p>
              <p className="mt-0.5 text-[11px] text-stone-500">
                GSTIN: {settings?.gstin}
              </p>
              <p className="mt-2 border-y border-dashed border-stone-300 py-1 font-semibold">
                TAX INVOICE · {table.table_number}
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
              {bill.payments
                .filter((p) => p.status === "paid")
                .map((p) => (
                  <p key={p.id}>
                    {p.receipt_number} · {p.method.toUpperCase()} ({p.channel.toUpperCase()}) ·{" "}
                    {formatCurrency(p.amount)}
                  </p>
                ))}
            </div>

            <div className="no-print mt-5 flex gap-2 font-sans">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white"
              >
                <Printer className="h-3.5 w-3.5" /> Print / PDF
              </button>
              <button
                type="button"
                onClick={() => setReceiptOpen(false)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
