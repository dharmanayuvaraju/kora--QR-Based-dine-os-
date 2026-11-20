"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Flag,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  QrCode,
  RotateCcw,
  Settings,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCodeCard } from "@/components/QrCodeCard";
import { DietaryMark } from "@/components/DietaryMark";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatTimeShort } from "@/lib/utils";
import type {
  AuditLog,
  Expense,
  InventoryItem,
  InventoryMovement,
  LowStockFlag,
  MenuCategory,
  MenuItem,
  Order,
  Payment,
  Refund,
  RestaurantSettings,
  RestaurantTable,
  SessionBillSummary,
  TableSession,
  User,
  UserRole,
  PasswordResetRequest,
} from "@/lib/types";

interface DashboardData {
  role: UserRole;
  storage_mode?: "supabase-postgres" | "local-ephemeral";
  settings: RestaurantSettings;
  kpis: {
    gross_order_value: number;
    net_collected: number;
    online_revenue: number;
    counter_revenue: number;
    total_tax: number;
    total_refunded: number;
    total_expenses: number | null;
    net_profit_est: number | null;
    avg_order_value: number;
    total_orders: number;
    active_orders_count: number;
    pending_approval_count: number;
    rejected_orders_count: number;
    occupied_tables_count: number;
    total_tables_count: number;
    low_stock_count: number;
    open_low_stock_flags_count?: number;
  };
  top_dishes: Array<{ name: string; qty: number; revenue: number }>;
  tables: Array<
    RestaurantTable & {
      assigned_staff: { id: string; full_name: string } | null;
      active_session: TableSession | null;
      bill: SessionBillSummary | null;
    }
  >;
  orders: Order[];
  payments: Payment[];
  refunds: Refund[];
  categories: MenuCategory[];
  menu_items: MenuItem[];
  users: User[];
  orphaned_user_ids?: string[];
  password_reset_requests?: PasswordResetRequest[];
  inventory_items: InventoryItem[];
  inventory_movements: InventoryMovement[];
  low_stock_flags: LowStockFlag[];
  expenses: Expense[];
  audit_logs: AuditLog[];
}

type TabId =
  | "overview"
  | "tables"
  | "orders"
  | "menu"
  | "payments"
  | "inventory"
  | "team"
  | "expenses"
  | "audit"
  | "settings";

export function ManagementSuite({
  user,
  logout,
  mode,
}: {
  user: User;
  logout: () => Promise<void>;
  mode: "owner" | "manager";
}) {
  const isOwner = mode === "owner" && user.role === "owner";
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  // Forms / Modals
  const [newTableNum, setNewTableNum] = useState("");
  const [newTableSection, setNewTableSection] = useState("Main Dining");
  const [newTableCap, setNewTableCap] = useState(4);

  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCat, setNewItemCat] = useState("");
  const [newItemDiet, setNewItemDiet] = useState<"veg" | "non_veg" | "vegan">("veg");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadErr, setImageUploadErr] = useState<string | null>(null);

  // Edit Dish Modal State
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [editDishName, setEditDishName] = useState("");
  const [editDishDesc, setEditDishDesc] = useState("");
  const [editDishPrice, setEditDishPrice] = useState("");
  const [editDishCat, setEditDishCat] = useState("");
  const [editDishDiet, setEditDishDiet] = useState<"veg" | "non_veg" | "vegan">("veg");
  const [editDishImageUrl, setEditDishImageUrl] = useState("");
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [editImageErr, setEditImageErr] = useState<string | null>(null);
  const [isSavingEditDish, setIsSavingEditDish] = useState(false);

  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [newEmpRole, setNewEmpRole] = useState<UserRole>("staff");
  const [empError, setEmpError] = useState<string | null>(null);
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    full_name: string;
    email: string;
    role: UserRole;
    temp_password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<User | null>(null);
  const [isDeletingEmpId, setIsDeletingEmpId] = useState<string | null>(null);
  const [isTogglingEmpId, setIsTogglingEmpId] = useState<string | null>(null);

  const [resetPasswordTarget, setResetPasswordTarget] = useState<User | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordErr, setResetPasswordErr] = useState<string | null>(null);

  const [newExpTitle, setNewExpTitle] = useState("");
  const [newExpCat, setNewExpCat] = useState<Expense["category"]>("ingredients");
  const [newExpAmt, setNewExpAmt] = useState("");

  const [settingsDraft, setSettingsDraft] = useState<Partial<RestaurantSettings>>({});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Cancel / Refund Modals
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const [stockModal, setStockModal] = useState<InventoryItem | null>(null);
  const [stockType, setStockType] = useState<"restock" | "deduction" | "wastage">("restock");
  const [stockQty, setStockQty] = useState("5");
  const [stockNote, setStockNote] = useState("");
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [ordersPage, setOrdersPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const PAGE_SIZE = 15;

  const notify = (text: string, tone: "ok" | "err" = "ok") => {
    setNotice({ text, tone });
    setTimeout(() => setNotice((prev) => (prev?.text === text ? null : prev)), 4500);
  };

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/v1/owner/dashboard", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as DashboardData;
      setData(json);
      setSettingsDraft((prev) => (Object.keys(prev).length ? prev : json.settings));
      setNewItemCat((prev) => prev || json.categories[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const { connected } = useRealtime(() => {
    loadDashboard();
  });

  const navItems: Array<{
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> =
    isOwner
      ? [
        { id: "overview", label: "Overview", icon: BarChart3 },
        { id: "tables", label: "Tables & QR Studio", icon: QrCode },
        { id: "orders", label: "Orders", icon: ClipboardList },
        { id: "menu", label: "Menu & Pricing", icon: BookOpen },
        { id: "payments", label: "Payments & Refunds", icon: CreditCard },
        { id: "inventory", label: "Inventory", icon: Package },
        { id: "expenses", label: "Expenses & P&L", icon: Wallet },
        { id: "team", label: "Employees & Roles", icon: Users },
        { id: "audit", label: "Audit Logs", icon: ShieldAlert },
        { id: "settings", label: "Settings & GST", icon: Settings },
      ]
      : [
        { id: "overview", label: "Live Overview", icon: BarChart3 },
        { id: "tables", label: "Floor Plan & Tables", icon: LayoutGrid },
        { id: "orders", label: "Active Orders", icon: ClipboardList },
        { id: "menu", label: "Menu Availability", icon: BookOpen },
        { id: "payments", label: "Payments & Refunds", icon: CreditCard },
        { id: "inventory", label: "Inventory", icon: Package },
        { id: "team", label: "Staff & Chefs", icon: Users },
        { id: "audit", label: "Activity Log", icon: ShieldAlert },
      ];

  const apiCall = async (
    url: string,
    method: string,
    body?: unknown,
    successMsg?: string
  ) => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(json.error ?? "Operation failed", "err");
      return false;
    }
    if (successMsg) notify(successMsg, "ok");
    await loadDashboard();
    return true;
  };

  const handleToggleEmployeeStatus = async (emp: User) => {
    const nextActive = !emp.is_active;
    setIsTogglingEmpId(emp.id);

    // Optimistic UI update: flip status immediately for responsive 1-click tactile response
    setData((prev) =>
      prev
        ? {
            ...prev,
            users: prev.users.map((u) =>
              u.id === emp.id ? { ...u, is_active: nextActive } : u
            ),
          }
        : null
    );

    try {
      const res = await fetch(`/api/v1/users/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Revert on failure
        setData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((u) =>
                  u.id === emp.id ? { ...u, is_active: !nextActive } : u
                ),
              }
            : null
        );
        notify(json.error || "Could not update employee status.", "err");
      } else {
        notify(
          `${emp.full_name} is now ${nextActive ? "Active" : "Disabled"}.`,
          "ok"
        );
        void loadDashboard();
      }
    } catch {
      setData((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) =>
                u.id === emp.id ? { ...u, is_active: !nextActive } : u
              ),
            }
          : null
      );
      notify("Network error while updating employee status.", "err");
    } finally {
      setIsTogglingEmpId(null);
    }
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!empToDelete) return;
    const target = empToDelete;
    setIsDeletingEmpId(target.id);
    setEmpToDelete(null);

    // Optimistic UI update: remove row immediately without blocking or freezing UI
    setData((prev) =>
      prev
        ? {
            ...prev,
            users: prev.users.filter((u) => u.id !== target.id),
          }
        : null
    );

    try {
      const res = await fetch(`/api/v1/users/${target.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(json.error || "Could not delete employee.", "err");
        await loadDashboard();
      } else {
        notify(`Permanently deleted ${target.full_name}.`, "ok");
        void loadDashboard();
      }
    } catch {
      notify("Network error while deleting employee.", "err");
      await loadDashboard();
    } finally {
      setIsDeletingEmpId(null);
    }
  };

  const handleImageFileUpload = async (file: File) => {
    setIsUploadingImage(true);
    setImageUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/menu/upload-image", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = json.error || "Failed to upload image.";
        setImageUploadErr(err);
        notify(err, "err");
      } else if (json.url) {
        setNewItemImageUrl(json.url);
        notify("Photo uploaded successfully!", "ok");
      }
    } catch {
      setImageUploadErr("Network error while uploading image.");
      notify("Network error while uploading image.", "err");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openEditDishModal = (item: MenuItem) => {
    setEditingDish(item);
    setEditDishName(item.name);
    setEditDishDesc(item.description || "");
    setEditDishPrice(String(item.price));
    setEditDishCat(item.category_id);
    setEditDishDiet(item.dietary === "non_veg" || item.dietary === "vegan" ? item.dietary : "veg");
    setEditDishImageUrl(item.image_url || "");
    setEditImageErr(null);
  };

  const handleEditImageFileUpload = async (file: File) => {
    setIsUploadingEditImage(true);
    setEditImageErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/menu/upload-image", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditImageErr(json.error || "Failed to upload photo.");
        notify(json.error || "Failed to upload photo.", "err");
      } else if (json.url) {
        setEditDishImageUrl(json.url);
        notify("Dish photo uploaded successfully!", "ok");
      }
    } catch {
      setEditImageErr("Network error while uploading photo.");
      notify("Network error while uploading photo.", "err");
    } finally {
      setIsUploadingEditImage(false);
    }
  };

  const handleSaveEditDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;
    const cleanName = editDishName.trim();
    if (!cleanName) {
      notify("Dish name cannot be empty.", "err");
      return;
    }
    const priceNum = Number(editDishPrice);
    if (!priceNum || priceNum < 1) {
      notify("Please enter a valid price.", "err");
      return;
    }

    // Duplicate check on edit (case-insensitive, exclude self)
    const isDup = data?.menu_items.some(
      (m) =>
        m.id !== editingDish.id &&
        !m.deleted_at &&
        m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDup) {
      notify(`A dish named "${cleanName}" already exists on the menu.`, "err");
      return;
    }

    setIsSavingEditDish(true);
    try {
      const ok = await apiCall(
        `/api/v1/menu/items/${editingDish.id}`,
        "PATCH",
        {
          name: cleanName,
          description: editDishDesc.trim(),
          price: priceNum,
          category_id: editDishCat,
          dietary: editDishDiet,
          image_url: editDishImageUrl.trim() || editingDish.image_url,
        },
        `Updated dish "${cleanName}"`
      );
      if (ok) {
        setEditingDish(null);
      }
    } finally {
      setIsSavingEditDish(false);
    }
  };

  const pendingResets = (data?.password_reset_requests ?? []).filter(
    (r) => r.status === "pending"
  );

  const staffUsers = (data?.users ?? []).filter(
    (u) => u.role === "staff" && u.is_active
  );
  const openFlags = (data?.low_stock_flags ?? []).filter((f) => f.status === "open");

  const updateDishStock = async (
    item: MenuItem,
    payload: { stock_count?: number; delta?: number }
  ) => {
    const ok = await apiCall(
      `/api/v1/menu/items/${item.id}/stock`,
      "PATCH",
      payload,
      `Updated stock for ${item.name}`
    );
    if (ok) {
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const renderLowStockAlerts = () => {
    if (openFlags.length === 0) return null;
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <Flag className="h-4 w-4 text-amber-700" strokeWidth={1.8} />
            Kitchen Low-Stock Alerts ({openFlags.length})
          </p>
          <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            Flagged by Chef
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {openFlags.map((flag) => {
            const liveItem = data?.menu_items.find((m) => m.id === flag.menu_item_id);
            const liveCount = liveItem ? liveItem.stock_count ?? 0 : flag.current_stock_count;
            return (
              <div
                key={flag.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">
                    {flag.menu_item_name}{" "}
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">
                      Stock: {liveCount}
                    </span>
                  </p>
                  <p className="mt-0.5 text-stone-600">
                    &ldquo;{flag.note}&rdquo; · Flagged by{" "}
                    <strong>{flag.flagged_by_name}</strong> at{" "}
                    {formatTimeShort(flag.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {liveItem && (
                    <button
                      type="button"
                      onClick={() => updateDishStock(liveItem, { delta: 10 })}
                      className="min-h-[34px] rounded-lg border border-stone-200 px-2.5 text-[11px] font-semibold text-stone-800 hover:bg-stone-100"
                    >
                      +10 Stock
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      apiCall(
                        `/api/v1/low-stock-flags/${flag.id}/resolve`,
                        "POST",
                        undefined,
                        `Resolved low-stock flag for ${flag.menu_item_name}`
                      )
                    }
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[11px] font-semibold text-white hover:bg-emerald-800"
                  >
                    <Check className="h-3.5 w-3.5" /> Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F7F8] pb-20 text-stone-900 lg:pb-0">
      <ConsoleHeader
        user={user}
        connected={connected}
        onLogout={logout}
        subtitle={isOwner ? "Owner Executive Suite" : "Manager Operations"}
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Left Sidebar Navigation */}
        <aside className="lg:w-60 lg:shrink-0">
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${active
                    ? "bg-stone-900 text-white shadow-xs"
                    : "text-stone-600 hover:bg-white hover:text-stone-900"
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.65} />
                  <span>{item.label}</span>
                  {item.id === "menu" && openFlags.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-stone-950">
                      {openFlags.length}
                    </span>
                  )}
                  {item.id === "team" && isOwner && pendingResets.length > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white animate-pulse">
                      <Bell className="h-2.5 w-2.5" />
                      {pendingResets.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-6">
          {notice && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${notice.tone === "err"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
            >
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ==================== OVERVIEW ==================== */}
          {tab === "overview" && data && (
            <>
              {renderLowStockAlerts()}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-medium text-stone-500">Net Collected Revenue</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900">
                    {formatCurrency(data.kpis.net_collected)}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Order book: {formatCurrency(data.kpis.gross_order_value)} · GST{" "}
                    {formatCurrency(data.kpis.total_tax)}
                  </p>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-medium text-stone-500">Active Dining Floor</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900">
                    {data.kpis.occupied_tables_count}
                    <span className="text-base font-normal text-stone-400">
                      /{data.kpis.total_tables_count} tables
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {data.kpis.active_orders_count} active orders ·{" "}
                    {data.kpis.pending_approval_count} waiting Chef
                  </p>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-medium text-stone-500">Average Order Value</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900">
                    {formatCurrency(data.kpis.avg_order_value)}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Across {data.kpis.total_orders} total orders ({data.kpis.rejected_orders_count}{" "}
                    rejected)
                  </p>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-medium text-stone-500">
                    {isOwner ? "Daily Expenses Logged" : "Inventory Watch"}
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900">
                    {isOwner
                      ? formatCurrency(data.kpis.total_expenses ?? 0)
                      : `${data.kpis.low_stock_count} low items`}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {isOwner
                      ? `Refunds issued: ${formatCurrency(data.kpis.total_refunded)}`
                      : "Items below reorder threshold"}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                {/* Payment Split & Channel Breakdown */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                    <TrendingUp className="h-4 w-4 text-[#C2410C]" />
                    Payment Channel Mix
                  </h2>
                  <div className="mt-4 space-y-4">
                    {[
                      {
                        label: "Online (Demo UPI / Cards)",
                        val: data.kpis.online_revenue,
                        color: "bg-sky-600",
                      },
                      {
                        label: "Pay at Counter (Cash / Counter UPI / POS)",
                        val: data.kpis.counter_revenue,
                        color: "bg-[#C2410C]",
                      },
                    ].map((row) => {
                      const total =
                        Math.max(1, data.kpis.online_revenue + data.kpis.counter_revenue);
                      const pct = Math.round((row.val / total) * 100);
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-stone-700">{row.label}</span>
                            <span className="font-mono font-semibold text-stone-900">
                              {formatCurrency(row.val)} ({pct}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className={`h-full rounded-full ${row.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {data.kpis.low_stock_count > 0 && (
                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        {data.kpis.low_stock_count} Ingredient
                        {data.kpis.low_stock_count === 1 ? "" : "s"} Low on Stock
                      </p>
                      <p className="mt-1 text-amber-800">
                        {data.inventory_items
                          .filter((i) => i.current_stock <= i.reorder_level)
                          .map((i) => `${i.name} (${i.current_stock} ${i.unit})`)
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Dishes Performance */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-7">
                  <h2 className="text-sm font-bold text-stone-900">
                    Top Ordered Dishes Today
                  </h2>
                  <div className="mt-4 space-y-3">
                    {data.top_dishes.map((dish, idx) => {
                      const maxRev = Math.max(1, data.top_dishes[0]?.revenue ?? 1);
                      const pct = Math.round((dish.revenue / maxRev) * 100);
                      return (
                        <div key={dish.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-stone-800">
                              <span className="mr-2 font-mono text-stone-400">
                                0{idx + 1}
                              </span>
                              {dish.name}
                            </span>
                            <span className="font-mono text-stone-600">
                              {dish.qty} sold ·{" "}
                              <strong className="text-stone-900">
                                {formatCurrency(dish.revenue)}
                              </strong>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full rounded-full bg-stone-900"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== TABLES, FLOOR PLAN & QR STUDIO ==================== */}
          {tab === "tables" && data && (
            <div className="space-y-5">
              {/* Create New Table Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTableNum.trim()) return;
                  const ok = await apiCall(
                    "/api/v1/tables",
                    "POST",
                    {
                      table_number: newTableNum.trim(),
                      section: newTableSection.trim(),
                      capacity: Number(newTableCap) || 4,
                    },
                    `Created ${newTableNum.trim()} with permanent QR code`
                  );
                  if (ok) setNewTableNum("");
                }}
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="min-w-[140px] flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Table Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTableNum}
                    onChange={(e) => setNewTableNum(e.target.value)}
                    placeholder="e.g. Table 09"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Floor Section
                  </label>
                  <input
                    type="text"
                    value={newTableSection}
                    onChange={(e) => setNewTableSection(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="w-24">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Seats
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableCap}
                    onChange={(e) => setNewTableCap(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Table + QR
                </button>
              </form>

              {/* Table Floor Grid + QR Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {data.tables.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                  >
                    <div>
                      <QrCodeCard
                        tableNumber={t.table_number}
                        section={`${t.section} · ${t.capacity} seats`}
                        qrToken={t.qr_token}
                        restaurantName={data.settings.name}
                        regenerating={regeneratingId === t.id}
                        onRegenerate={async () => {
                          setRegeneratingId(t.id);
                          await apiCall(
                            `/api/v1/tables/${t.id}/qr/regenerate`,
                            "POST",
                            undefined,
                            `Regenerated QR token for ${t.table_number}. Previous QR invalidated.`
                          );
                          setRegeneratingId(null);
                        }}
                        compact
                      />

                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500">Assigned Staff</span>
                          <select
                            value={t.assigned_staff?.id ?? ""}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              apiCall(
                                `/api/v1/tables/${t.id}/assign`,
                                "POST",
                                { staff_id: e.target.value },
                                `Assigned waiter to ${t.table_number}`
                              );
                            }}
                            className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium"
                          >
                            <option value="">Unassigned</option>
                            {staffUsers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-stone-500">Session</span>
                          {t.active_session ? (
                            <span className="font-mono font-semibold text-emerald-700">
                              {t.active_session.status === "payment_pending"
                                ? "Bill Pending"
                                : "Active"}{" "}
                              · Due {formatCurrency(t.bill?.balance_due ?? 0)}
                            </span>
                          ) : (
                            <span className="text-stone-400">Available</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                      {!t.active_session ? (
                        <button
                          type="button"
                          onClick={() =>
                            apiCall(
                              `/api/v1/tables/${t.id}/session/open`,
                              "POST",
                              { guest_count: 2 },
                              `Opened session for ${t.table_number}`
                            )
                          }
                          className="w-full rounded-lg border border-stone-200 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                        >
                          Open Session
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const hasDue = (t.bill?.balance_due ?? 0) > 0.01;
                            const reason = hasDue
                              ? window.prompt(
                                `${t.table_number} still has ₹${t.bill?.balance_due} unpaid. Enter manager force-close reason (audited):`
                              )
                              : "";
                            if (hasDue && !reason?.trim()) return;
                            apiCall(
                              `/api/v1/sessions/${t.active_session!.id}/close`,
                              "POST",
                              { force: hasDue, reason: reason || undefined },
                              `Closed session for ${t.table_number}`
                            );
                          }}
                          className="w-full rounded-lg border border-rose-200 bg-rose-50 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          {(t.bill?.balance_due ?? 0) > 0.01
                            ? "Force Close Table"
                            : "Close Table"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== ORDERS MONITOR ==================== */}
          {tab === "orders" && data && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Items &amp; Status</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.orders
                        .slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE)
                        .map((order) => (
                          <tr key={order.id} className="align-top">
                            <td className="px-4 py-3 font-mono font-bold text-stone-900">
                              #{order.order_number}
                              <p className="font-sans text-[11px] font-normal text-stone-400">
                                {formatTimeShort(order.created_at)}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-semibold">{order.table_number}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {order.items.map((i) => (
                                  <div key={i.id} className="flex items-center gap-2">
                                    <span>
                                      {i.quantity}× {i.item_name_snapshot}
                                    </span>
                                    <StatusBadge status={i.status} compact />
                                  </div>
                                ))}
                                {order.rejection_reason && (
                                  <p className="text-rose-700">
                                    Chef Rejection: {order.rejection_reason}
                                  </p>
                                )}
                                {order.cancellation_reason && (
                                  <p className="text-rose-700">
                                    Cancelled: {order.cancellation_reason}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold">
                              {formatCurrency(order.total_amount)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={order.status} compact />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!["completed", "cancelled", "rejected"].includes(order.status) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelOrderTarget(order);
                                    setCancelReason("");
                                  }}
                                  className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Authorize Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {data.orders.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>
                    Page {ordersPage} of {Math.ceil(data.orders.length / PAGE_SIZE)} ({data.orders.length} orders)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ordersPage <= 1}
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={ordersPage * PAGE_SIZE >= data.orders.length}
                      onClick={() => setOrdersPage((p) => p + 1)}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== MENU & PRICING MANAGEMENT ==================== */}
          {tab === "menu" && data && (
            <div className="space-y-5">
              {renderLowStockAlerts()}
              {isOwner && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmedName = newItemName.trim();
                    if (!trimmedName || !newItemPrice || !newItemCat) return;

                    const isDup = data.menu_items.some(
                      (m) =>
                        !m.deleted_at &&
                        m.name.trim().toLowerCase() === trimmedName.toLowerCase()
                    );
                    if (isDup) {
                      notify(
                        `A dish named "${trimmedName}" already exists on the menu.`,
                        "err"
                      );
                      return;
                    }

                    const ok = await apiCall(
                      "/api/v1/menu/items",
                      "POST",
                      {
                        name: trimmedName,
                        description: newItemDesc.trim(),
                        price: Number(newItemPrice),
                        category_id: newItemCat,
                        dietary: newItemDiet,
                        image_url: newItemImageUrl.trim() || undefined,
                      },
                      `Added "${trimmedName}" to live menu`
                    );
                    if (ok) {
                      setNewItemName("");
                      setNewItemDesc("");
                      setNewItemPrice("");
                      setNewItemImageUrl("");
                      setImageUploadErr(null);
                    }
                  }}
                  className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Dish name"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs lg:col-span-2"
                  />
                  <input
                    type="text"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="Short description"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs lg:col-span-2"
                  />
                  <select
                    value={newItemCat}
                    onChange={(e) => setNewItemCat(e.target.value)}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  >
                    {(data?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="₹ Price"
                      className="w-24 rounded-xl border border-stone-200 px-3 py-2 font-mono text-xs"
                    />
                    <select
                      value={newItemDiet}
                      onChange={(e) =>
                        setNewItemDiet(e.target.value as "veg" | "non_veg" | "vegan")
                      }
                      className="rounded-xl border border-stone-200 px-2 py-2 text-xs"
                    >
                      <option value="veg">Veg</option>
                      <option value="non_veg">Non-Veg</option>
                      <option value="vegan">Vegan</option>
                    </select>
                  </div>

                  {/* Photo Upload & URL Field */}
                  <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-stone-200 bg-stone-50/70 p-2.5 sm:col-span-2 lg:col-span-6">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50">
                      <Upload className="h-3.5 w-3.5 text-stone-500" strokeWidth={1.75} />
                      {isUploadingImage ? "Uploading..." : "Upload Photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        disabled={isUploadingImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageFileUpload(f);
                        }}
                        className="hidden"
                      />
                    </label>
                    <div className="relative min-w-[220px] flex-1">
                      <input
                        type="text"
                        value={newItemImageUrl}
                        onChange={(e) => setNewItemImageUrl(e.target.value)}
                        placeholder="Or enter image URL (https://... or /dishes/...)"
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C2410C]"
                      />
                    </div>
                    {newItemImageUrl && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white p-1">
                        <img
                          src={newItemImageUrl}
                          alt="Dish thumbnail"
                          className="h-7 w-7 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/dishes/black-dal.jpg";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setNewItemImageUrl("")}
                          className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          title="Remove photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {imageUploadErr && (
                      <span className="text-xs font-medium text-rose-600">
                        {imageUploadErr}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] sm:col-span-2 lg:col-span-6"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add New Dish to Digital Menu
                  </button>
                </form>
              )}

              {/* Mobile stacked cards (<640px) with stock count steppers & controls */}
              <div className="space-y-3 sm:hidden">
                {data.menu_items.map((item) => {
                  const catName =
                    data.categories.find((c) => c.id === item.category_id)?.name ?? "-";
                  const countVal = stockDrafts[item.id] ?? String(item.stock_count ?? 0);
                  const isOut = !item.is_available || (item.stock_count ?? 0) <= 0;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-stone-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <img
                            src={item.image_url || "/dishes/black-dal.jpg"}
                            alt={item.name}
                            className="h-12 w-12 shrink-0 rounded-xl object-cover border border-stone-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/dishes/black-dal.jpg";
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0">
                                <DietaryMark dietary={item.dietary} />
                              </span>
                              <p className="text-sm font-semibold text-stone-900">
                                {item.name}
                              </p>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              {catName} ·{" "}
                              <span className="font-mono font-semibold text-stone-900">
                                {formatCurrency(item.price)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${!isOut
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-rose-50 text-rose-800"
                            }`}
                        >
                          {!isOut ? "Available" : "Sold Out"}
                        </span>
                      </div>

                      {/* Stock Count Stepper + Direct Number Input */}
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
                        <span className="text-xs font-semibold text-stone-600">
                          Stock Portions
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDishStock(item, { delta: -1 })}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                            aria-label={`Decrease stock for ${item.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={countVal}
                            onChange={(e) =>
                              setStockDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                            }
                            onBlur={() => {
                              const parsed = Number(countVal);
                              if (Number.isFinite(parsed) && parsed !== (item.stock_count ?? 0)) {
                                updateDishStock(item, { stock_count: Math.max(0, Math.floor(parsed)) });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="h-9 w-16 rounded-lg border border-stone-200 bg-white text-center font-mono text-xs font-semibold"
                            aria-label={`Stock count for ${item.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateDishStock(item, { delta: 1 })}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                            aria-label={`Increase stock for ${item.name}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            apiCall(
                              `/api/v1/menu/items/${item.id}/availability`,
                              "PATCH",
                              { is_available: !item.is_available },
                              `${item.name} marked ${!item.is_available ? "Available" : "Sold Out"}`
                            )
                          }
                          className="min-h-[38px] flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                        >
                          {item.is_available ? "Mark 86" : "Restore"}
                        </button>
                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditDishModal(item)}
                              className="min-h-[38px] rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                            >
                              Edit Dish
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Archive "${item.name}" from the active menu?`))
                                  return;
                                apiCall(
                                  `/api/v1/menu/items/${item.id}`,
                                  "DELETE",
                                  undefined,
                                  `Archived ${item.name}`
                                );
                              }}
                              className="min-h-[38px] rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet horizontally-scrollable table with stock steppers */}
              <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Dish</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock Count</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.menu_items.map((item) => {
                        const catName =
                          data.categories.find((c) => c.id === item.category_id)?.name ?? "-";
                        const countVal = stockDrafts[item.id] ?? String(item.stock_count ?? 0);
                        const isOut = !item.is_available || (item.stock_count ?? 0) <= 0;
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.image_url || "/dishes/black-dal.jpg"}
                                  alt={item.name}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover border border-stone-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/dishes/black-dal.jpg";
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <DietaryMark dietary={item.dietary} />
                                    <p className="font-semibold text-stone-900">{item.name}</p>
                                  </div>
                                  <p className="line-clamp-1 text-[11px] text-stone-400">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                              {catName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateDishStock(item, { delta: -1 })}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-700 hover:bg-stone-100"
                                  aria-label={`Decrease stock for ${item.name}`}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={countVal}
                                  onChange={(e) =>
                                    setStockDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                                  }
                                  onBlur={() => {
                                    const parsed = Number(countVal);
                                    if (
                                      Number.isFinite(parsed) &&
                                      parsed !== (item.stock_count ?? 0)
                                    ) {
                                      updateDishStock(item, {
                                        stock_count: Math.max(0, Math.floor(parsed)),
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="h-7 w-14 rounded-md border border-stone-200 text-center font-mono text-xs font-semibold"
                                  aria-label={`Stock count for ${item.name}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateDishStock(item, { delta: 1 })}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-700 hover:bg-stone-100"
                                  aria-label={`Increase stock for ${item.name}`}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${!isOut
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-rose-50 text-rose-800"
                                  }`}
                              >
                                {!isOut ? "Available" : "Sold Out"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    apiCall(
                                      `/api/v1/menu/items/${item.id}/availability`,
                                      "PATCH",
                                      { is_available: !item.is_available },
                                      `${item.name} marked ${!item.is_available ? "Available" : "Sold Out"}`
                                    )
                                  }
                                  className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                                >
                                  {item.is_available ? "Mark 86" : "Restore"}
                                </button>
                                {isOwner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditDishModal(item)}
                                      className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!window.confirm(`Archive "${item.name}" from the active menu?`))
                                          return;
                                        apiCall(
                                          `/api/v1/menu/items/${item.id}`,
                                          "DELETE",
                                          undefined,
                                          `Archived ${item.name}`
                                        );
                                      }}
                                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                    >
                                      Archive
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== PAYMENTS & REFUNDS ==================== */}
          {tab === "payments" && data && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="border-b border-stone-100 px-5 py-3.5">
                  <h2 className="text-sm font-bold text-stone-900">
                    Payment Reconciliation Ledger
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Receipt</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Method / Channel</th>
                        <th className="px-4 py-3">Collected By</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Refund</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-mono font-semibold text-stone-900">
                            {p.receipt_number}
                          </td>
                          <td className="px-4 py-3">{p.table_number}</td>
                          <td className="px-4 py-3 uppercase">
                            {p.method} · {p.channel}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {p.collected_by_name ?? "Gateway"}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${p.status === "paid"
                                ? "bg-emerald-50 text-emerald-800"
                                : p.status === "refunded"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-rose-50 text-rose-800"
                                }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.status === "paid" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTarget(p);
                                  setRefundAmount(String(p.amount));
                                  setRefundReason("");
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                <RotateCcw className="h-3 w-3" /> Issue Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {data.refunds.length > 0 && (
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <h3 className="text-sm font-bold text-stone-900">Authorized Refunds</h3>
                  <div className="mt-3 space-y-2 text-xs">
                    {data.refunds.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl bg-stone-50 px-3.5 py-2.5"
                      >
                        <div>
                          <p className="font-semibold text-stone-900">
                            {formatCurrency(r.amount)} refunded · By {r.authorized_by_name}
                          </p>
                          <p className="text-stone-500">Reason: {r.reason}</p>
                        </div>
                        <span className="font-mono text-stone-400">
                          {formatTimeShort(r.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== INVENTORY ==================== */}
          {tab === "inventory" && data && (
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white lg:col-span-8">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Ingredient</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Reorder Level</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.inventory_items.map((inv) => {
                        const low = inv.current_stock <= inv.reorder_level;
                        return (
                          <tr key={inv.id}>
                            <td className="px-4 py-3 font-semibold text-stone-900">
                              {inv.name}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold">
                              <span className={low ? "text-rose-600" : "text-stone-900"}>
                                {inv.current_stock} {inv.unit}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-stone-500">
                              {inv.reorder_level} {inv.unit}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setStockModal(inv);
                                  setStockQty("5");
                                  setStockNote("");
                                }}
                                className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                              >
                                Adjust Stock
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:col-span-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Recent Stock Movements
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  {data.inventory_movements.map((m) => (
                    <div key={m.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="flex justify-between font-semibold">
                        <span>{m.inventory_item_name}</span>
                        <span
                          className={`font-mono ${m.quantity_delta >= 0 ? "text-emerald-700" : "text-rose-700"
                            }`}
                        >
                          {m.quantity_delta >= 0 ? "+" : ""}
                          {m.quantity_delta}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        {m.note} · {m.actor_name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== EXPENSES (OWNER ONLY) ==================== */}
          {tab === "expenses" && isOwner && data && (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newExpTitle.trim() || !Number(newExpAmt)) return;
                  const ok = await apiCall(
                    "/api/v1/owner/dashboard",
                    "POST",
                    {
                      title: newExpTitle.trim(),
                      category: newExpCat,
                      amount: Number(newExpAmt),
                    },
                    "Expense logged to daily P&L"
                  );
                  if (ok) {
                    setNewExpTitle("");
                    setNewExpAmt("");
                  }
                }}
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="min-w-[200px] flex-1">
                  <label className="text-[11px] font-semibold uppercase text-stone-500">
                    Expense Description
                  </label>
                  <input
                    type="text"
                    required
                    value={newExpTitle}
                    onChange={(e) => setNewExpTitle(e.target.value)}
                    placeholder="e.g. Artisanal Paneer Vendor Delivery"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                </div>
                <select
                  value={newExpCat}
                  onChange={(e) => setNewExpCat(e.target.value as Expense["category"])}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                >
                  <option value="ingredients">Ingredients</option>
                  <option value="utilities">Utilities</option>
                  <option value="staff">Staff</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="number"
                  required
                  min={1}
                  value={newExpAmt}
                  onChange={(e) => setNewExpAmt(e.target.value)}
                  placeholder="₹ Amount"
                  className="w-32 rounded-xl border border-stone-200 px-3 py-2 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C]"
                >
                  Record Expense
                </button>
              </form>

              {/* Mobile stacked cards (<640px) */}
              <div className="space-y-3 sm:hidden">
                {data.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900">{exp.title}</p>
                      <span className="shrink-0 font-mono text-sm font-bold text-rose-700">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs capitalize text-stone-500">
                      {exp.category} · Recorded by {exp.recorded_by}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Expense</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Recorded By</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.expenses.map((exp) => (
                        <tr key={exp.id}>
                          <td className="px-4 py-3 font-semibold text-stone-900">
                            {exp.title}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 capitalize text-stone-600">
                            {exp.category}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                            {exp.recorded_by}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-rose-700">
                            {formatCurrency(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== EMPLOYEES & ROLES ==================== */}
          {tab === "team" && data && (
            <div className="space-y-5">
              {/* Owner Notification: Pending Password Reset Requests */}
              {isOwner && pendingResets.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <Bell className="h-4 w-4 text-amber-700" strokeWidth={1.75} />
                    <span>
                      {pendingResets.length} Password Reset Request
                      {pendingResets.length === 1 ? "" : "s"} Pending
                    </span>
                  </div>
                  <p className="mt-1 text-stone-600">
                    Staff members below requested password resets. Set a new password for them directly from here:
                  </p>
                  <div className="mt-3 space-y-2">
                    {pendingResets.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-white p-3 shadow-2xs"
                      >
                        <div>
                          <p className="font-bold text-stone-900">
                            {req.full_name}{" "}
                            <span className="font-mono font-normal text-stone-500">
                              ({req.email})
                            </span>
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Role:{" "}
                            <span className="font-semibold uppercase text-[#C2410C]">
                              {req.role}
                            </span>{" "}
                            · Requested {formatTimeShort(req.created_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const emp = data.users.find(
                              (u) =>
                                u.id === req.user_id ||
                                u.email.toLowerCase() === req.email.toLowerCase()
                            );
                            if (emp) {
                              setResetPasswordTarget(emp);
                              setNewPasswordVal("");
                              setResetPasswordErr(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#9A3412]"
                        >
                          <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Set New Password
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Owner Notification: Orphaned Records Cleanup */}
              {isOwner && data.orphaned_user_ids && data.orphaned_user_ids.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
                      Detected {data.orphaned_user_ids.length} Orphaned Employee Record(s)
                    </div>
                    <p className="mt-0.5 text-stone-600">
                      These rows exist in database rosters but have no corresponding Supabase Auth credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      for (const id of data.orphaned_user_ids!) {
                        await fetch(`/api/v1/users/${id}`, { method: "DELETE" });
                      }
                      notify("Orphaned records successfully removed.", "ok");
                      await loadDashboard();
                    }}
                    className="rounded-xl bg-stone-900 px-3.5 py-2 font-semibold text-white hover:bg-stone-800"
                  >
                    Clean Up Orphaned Records
                  </button>
                </div>
              )}
              {/* Inline Error Banner */}
              {empError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" strokeWidth={1.65} />
                    <span className="font-medium">{empError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmpError(null)}
                    className="rounded-md p-1 text-rose-600 hover:bg-rose-100 hover:text-rose-900"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.65} />
                  </button>
                </div>
              )}

              {/* Newly Created Credentials Card */}
              {createdCredentials && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-emerald-950 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.65} />
                      <div>
                        <p className="text-sm font-bold text-emerald-950">Employee Account Provisioned</p>
                        <p className="mt-0.5 text-xs text-emerald-800">
                          Share these credentials directly with the employee. No email verification is required; they can log in immediately.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatedCredentials(null)}
                      className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-950"
                      aria-label="Dismiss credentials card"
                    >
                      <X className="h-4 w-4" strokeWidth={1.65} />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2.5 rounded-xl border border-emerald-200/80 bg-white p-3.5 text-xs sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Full Name</span>
                      <p className="font-semibold text-stone-900">{createdCredentials.full_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Assigned Role</span>
                      <p className="font-semibold uppercase text-[#C2410C]">{createdCredentials.role}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">User ID (Email)</span>
                      <p className="font-mono font-medium text-stone-900 select-all">{createdCredentials.email}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Initial Password</span>
                      <p className="font-mono font-bold text-stone-900 select-all">{createdCredentials.temp_password}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const credsText = `KORA DineOS Credentials\nRole: ${createdCredentials.role.toUpperCase()}\nName: ${createdCredentials.full_name}\nUser ID: ${createdCredentials.email}\nPassword: ${createdCredentials.temp_password}\nSign-in URL: ${typeof window !== "undefined" ? window.location.origin : ""}/${createdCredentials.role}`;
                        navigator.clipboard.writeText(credsText);
                        setCopiedCreds(true);
                        setTimeout(() => setCopiedCreds(false), 2500);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                    >
                      {copiedCreds ? (
                        <>
                          <Check className="h-3.5 w-3.5" strokeWidth={1.65} />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.65} />
                          Copy Credentials
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setEmpError(null);
                  if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword) {
                    setEmpError("Please enter full name, employee email, and initial password.");
                    return;
                  }
                  if (newEmpPassword.length < 8) {
                    setEmpError("Password must be at least 8 characters.");
                    return;
                  }
                  const roleToCreate: UserRole = isOwner
                    ? newEmpRole
                    : (newEmpRole === "manager" ? "staff" : newEmpRole);
                  setIsCreatingEmp(true);
                  try {
                    const res = await fetch("/api/v1/users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        full_name: newEmpName.trim(),
                        email: newEmpEmail.trim(),
                        password: newEmpPassword,
                        role: roleToCreate,
                      }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      const errText = json.error || "Failed to create employee.";
                      setEmpError(errText);
                      notify(errText, "err");
                      return;
                    }

                    setCreatedCredentials({
                      full_name: newEmpName.trim(),
                      email: newEmpEmail.trim(),
                      role: roleToCreate,
                      temp_password: newEmpPassword,
                    });
                    setNewEmpName("");
                    setNewEmpEmail("");
                    setNewEmpPassword("");
                    setNewEmpRole("staff");
                    notify(`Created ${roleToCreate.toUpperCase()} account for ${newEmpName.trim()}`, "ok");
                    await loadDashboard();
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Network error";
                    setEmpError(msg);
                    notify(msg, "err");
                  } finally {
                    setIsCreatingEmp(false);
                  }
                }}
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
              >
                <div className="min-w-[140px] flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={(e) => {
                      setNewEmpName(e.target.value);
                      if (empError) setEmpError(null);
                    }}
                    placeholder="e.g. Ramesh Kumar"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Employee User ID (Email)
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmpEmail}
                    onChange={(e) => {
                      setNewEmpEmail(e.target.value);
                      if (empError) setEmpError(null);
                    }}
                    placeholder="employee@kora.in"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Initial Password (8+ chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newEmpPassword}
                    onChange={(e) => {
                      setNewEmpPassword(e.target.value);
                      if (empError) setEmpError(null);
                    }}
                    placeholder="Set password directly"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div className="w-36">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Role
                  </label>
                  <select
                    value={!isOwner && newEmpRole === "manager" ? "staff" : newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#C2410C]"
                  >
                    <option value="staff">Staff (Waiter)</option>
                    <option value="chef">Chef (Kitchen)</option>
                    {isOwner && <option value="manager">Manager</option>}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isCreatingEmp}
                  className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#C2410C] disabled:opacity-60"
                >
                  {isCreatingEmp ? "Provisioning..." : "Create Employee"}
                </button>
              </form>

              {/* Mobile stacked cards (<640px) */}
              <div className="space-y-3 sm:hidden">
                {data.users.map((emp) => {
                  const isSelf = emp.id === user.id;
                  const canToggle =
                    !isSelf &&
                    (isOwner || emp.role === "staff" || emp.role === "chef");
                  const canDelete = isOwner && !isSelf;
                  const canResetPass = isOwner && !isSelf;
                  const hasPendingReset = pendingResets.some(
                    (r) =>
                      r.user_id === emp.id ||
                      r.email.toLowerCase() === emp.email.toLowerCase()
                  );
                  const isOrphaned = Boolean(data.orphaned_user_ids?.includes(emp.id));
                  return (
                    <div
                      key={emp.id}
                      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold text-stone-900">
                              {emp.full_name}
                            </p>
                            {hasPendingReset && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Reset Requested
                              </span>
                            )}
                            {isOrphaned && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                Orphaned
                              </span>
                            )}
                          </div>
                          <p className="truncate font-mono text-xs text-stone-500">
                            {emp.email}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            emp.is_active
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {emp.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5">
                        <span className="text-xs font-semibold uppercase text-[#C2410C]">
                          {emp.role}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canResetPass && (
                            <button
                              type="button"
                              onClick={() => {
                                setResetPasswordTarget(emp);
                                setNewPasswordVal("");
                                setResetPasswordErr(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                            >
                              <KeyRound className="h-3 w-3" strokeWidth={1.65} />
                              Password
                            </button>
                          )}
                          {canToggle && (
                            <button
                              type="button"
                              disabled={isTogglingEmpId === emp.id}
                              onClick={() => handleToggleEmployeeStatus(emp)}
                              className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                            >
                              {isTogglingEmpId === emp.id
                                ? "Updating..."
                                : emp.is_active
                                ? "Disable"
                                : "Re-enable"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={isDeletingEmpId === emp.id}
                              onClick={() => setEmpToDelete(emp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-60"
                            >
                              <Trash2 className="h-3 w-3" strokeWidth={1.65} />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.users.map((emp) => {
                        const isSelf = emp.id === user.id;
                        const canToggle =
                          !isSelf &&
                          (isOwner || emp.role === "staff" || emp.role === "chef");
                        const canDelete = isOwner && !isSelf;
                        const canResetPass = isOwner && !isSelf;
                        const hasPendingReset = pendingResets.some(
                          (r) =>
                            r.user_id === emp.id ||
                            r.email.toLowerCase() === emp.email.toLowerCase()
                        );
                        const isOrphaned = Boolean(data.orphaned_user_ids?.includes(emp.id));
                        return (
                          <tr key={emp.id}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-stone-900">
                              <div className="flex items-center gap-2">
                                <span>{emp.full_name}</span>
                                {hasPendingReset && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    Reset Requested
                                  </span>
                                )}
                                {isOrphaned && (
                                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                    Orphaned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-stone-600">
                              {emp.email}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-[#C2410C]">
                              {emp.role}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  emp.is_active
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-stone-200 text-stone-600"
                                }`}
                              >
                                {emp.is_active ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {canResetPass && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetPasswordTarget(emp);
                                      setNewPasswordVal("");
                                      setResetPasswordErr(null);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                                    title="Set new password directly"
                                  >
                                    <KeyRound className="h-3 w-3" strokeWidth={1.65} />
                                    Password
                                  </button>
                                )}
                                {canToggle && (
                                  <button
                                    type="button"
                                    disabled={isTogglingEmpId === emp.id}
                                    onClick={() => handleToggleEmployeeStatus(emp)}
                                    className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                                  >
                                    {isTogglingEmpId === emp.id
                                      ? "Updating..."
                                      : emp.is_active
                                      ? "Disable"
                                      : "Re-enable"}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    disabled={isDeletingEmpId === emp.id}
                                    onClick={() => setEmpToDelete(emp)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-60"
                                  >
                                    <Trash2 className="h-3 w-3" strokeWidth={1.65} />
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Non-blocking Employee Deletion Modal (Owner-only) */}
              {empToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                        <Trash2 className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900">
                          Delete Employee Account?
                        </h3>
                        <p className="text-xs text-stone-500">
                          Permanently remove employee credentials and records
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-700">
                      <p className="font-semibold text-stone-900">{empToDelete.full_name}</p>
                      <p className="font-mono text-stone-500">{empToDelete.email}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-[#C2410C]">
                        Role: {empToDelete.role}
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-stone-600 leading-relaxed">
                      This action is irreversible. The account will be permanently removed from Supabase Auth and restaurant rosters.
                    </p>

                    <div className="mt-5 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        disabled={isDeletingEmpId === empToDelete.id}
                        onClick={() => setEmpToDelete(null)}
                        className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingEmpId === empToDelete.id}
                        onClick={handleConfirmDeleteEmployee}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {isDeletingEmpId === empToDelete.id ? "Deleting..." : "Permanently Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Set New Password Modal (Owner-only) */}
              {resetPasswordTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#C2410C]">
                        <KeyRound className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900">
                          Set Employee Password
                        </h3>
                        <p className="text-xs text-stone-500">
                          Update credentials for {resetPasswordTarget.full_name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-700">
                      <p className="font-semibold text-stone-900">{resetPasswordTarget.full_name}</p>
                      <p className="font-mono text-stone-500">{resetPasswordTarget.email}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-[#C2410C]">
                        Role: {resetPasswordTarget.role}
                      </p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newPasswordVal || newPasswordVal.length < 8) {
                          setResetPasswordErr("Password must be at least 8 characters.");
                          return;
                        }
                        setIsResettingPassword(true);
                        setResetPasswordErr(null);
                        try {
                          const res = await fetch(
                            `/api/v1/users/${resetPasswordTarget.id}/reset-password`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password: newPasswordVal }),
                            }
                          );
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setResetPasswordErr(json.error || "Failed to set password.");
                          } else {
                            notify(
                              `Password updated for ${resetPasswordTarget.full_name}.`,
                              "ok"
                            );
                            setResetPasswordTarget(null);
                            setNewPasswordVal("");
                            await loadDashboard();
                          }
                        } catch {
                          setResetPasswordErr("Network error while resetting password.");
                        } finally {
                          setIsResettingPassword(false);
                        }
                      }}
                      className="mt-4 space-y-3"
                    >
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                          New Password (8+ characters)
                        </label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={newPasswordVal}
                          onChange={(e) => {
                            setNewPasswordVal(e.target.value);
                            if (resetPasswordErr) setResetPasswordErr(null);
                          }}
                          placeholder="Enter new password directly"
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                        />
                      </div>
                      {resetPasswordErr && (
                        <p className="text-xs font-medium text-rose-600">
                          {resetPasswordErr}
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={isResettingPassword}
                          onClick={() => {
                            setResetPasswordTarget(null);
                            setNewPasswordVal("");
                            setResetPasswordErr(null);
                          }}
                          className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isResettingPassword}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C2410C] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#9A3412] disabled:opacity-60"
                        >
                          <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {isResettingPassword ? "Saving..." : "Set Password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== AUDIT LOGS ==================== */}
          {tab === "audit" && data && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="border-b border-stone-100 px-5 py-3.5">
                  <h2 className="text-sm font-bold text-stone-900">
                    Immutable Audit Trail ({data.audit_logs.length} events)
                  </h2>
                  <p className="text-xs text-stone-500">
                    Every refund, cancellation, QR regeneration, stock change, and manual
                    payment is permanently recorded.
                  </p>
                </div>
                <div className="divide-y divide-stone-100 text-xs">
                  {data.audit_logs
                    .slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-stone-800">
                            {log.action}
                          </span>
                          <span className="ml-2 font-medium text-stone-800">
                            {log.actor_name}{" "}
                            <span className="uppercase text-stone-400">({log.actor_role})</span>
                          </span>
                          <p className="mt-1 break-all font-mono text-[11px] text-stone-500">
                            {JSON.stringify(log.metadata)}
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-stone-400">
                          {formatTimeShort(log.created_at)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              {data.audit_logs.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>
                    Page {auditPage} of {Math.ceil(data.audit_logs.length / PAGE_SIZE)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={auditPage * PAGE_SIZE >= data.audit_logs.length}
                      onClick={() => setAuditPage((p) => p + 1)}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== OWNER SETTINGS & GST ==================== */}
          {tab === "settings" && isOwner && data && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                apiCall(
                  "/api/v1/owner/settings",
                  "PATCH",
                  {
                    name: settingsDraft.name,
                    tagline: settingsDraft.tagline,
                    address: settingsDraft.address,
                    gstin: settingsDraft.gstin,
                    tax_rate_percent: Number(settingsDraft.tax_rate_percent ?? 5),
                    service_charge_percent: Number(
                      settingsDraft.service_charge_percent ?? 0
                    ),
                  },
                  "Restaurant billing & GST configuration saved"
                );
              }}
              className="max-w-2xl space-y-4 rounded-2xl border border-stone-200 bg-white p-6"
            >
              <h2 className="font-serif text-lg font-semibold text-stone-900">
                Restaurant Profile &amp; Tax Configuration
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-600">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.name ?? ""}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600">GSTIN</label>
                  <input
                    type="text"
                    value={settingsDraft.gstin ?? ""}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, gstin: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-stone-600">Address</label>
                  <input
                    type="text"
                    value={settingsDraft.address ?? ""}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, address: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={28}
                    value={settingsDraft.tax_rate_percent ?? 5}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        tax_rate_percent: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600">
                    Service Charge (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={20}
                    value={settingsDraft.service_charge_percent ?? 0}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        service_charge_percent: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C]"
              >
                Save Configuration
              </button>
            </form>
          )}
        </main>
      </div>

      {/* AUTHORIZED CANCEL MODAL */}
      {cancelOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-base font-bold text-stone-900">
              Cancel Order #{cancelOrderTarget.order_number} ({cancelOrderTarget.table_number})
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Manager/Owner cancellation requires a mandatory reason and writes an audit log.
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Guest changed mind before cooking started"
              className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOrderTarget(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={async () => {
                  const ok = await apiCall(
                    `/api/v1/orders/${cancelOrderTarget.id}/cancel`,
                    "POST",
                    { reason: cancelReason.trim() },
                    `Order #${cancelOrderTarget.order_number} cancelled`
                  );
                  if (ok) setCancelOrderTarget(null);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHORIZED REFUND MODAL */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-base font-bold text-stone-900">
              Issue Refund ({refundTarget.receipt_number})
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Original payment: {formatCurrency(refundTarget.amount)} ({refundTarget.table_number})
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-600">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={refundTarget.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">
                  Audit Reason
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Delayed dish goodwill refund"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await apiCall(
                    `/api/v1/payments/${refundTarget.id}/refund`,
                    "POST",
                    { amount: Number(refundAmount), reason: refundReason },
                    `Refund of ₹${refundAmount} processed & logged`
                  );
                  if (ok) setRefundTarget(null);
                }}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Authorize Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY ADJUSTMENT MODAL */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-base font-bold text-stone-900">
              Adjust Stock: {stockModal.name}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Current level: {stockModal.current_stock} {stockModal.unit}
            </p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["restock", "deduction", "wastage"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStockType(t)}
                    className={`rounded-xl border py-2 text-xs font-semibold capitalize ${stockType === t
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 text-stone-700"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.1"
                min={0.1}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder={`Quantity (${stockModal.unit})`}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm"
              />
              <input
                type="text"
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder="Note (e.g. Vendor delivery #412)"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStockModal(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await apiCall(
                    "/api/v1/inventory",
                    "POST",
                    {
                      inventory_item_id: stockModal.id,
                      movement_type: stockType,
                      quantity: Number(stockQty),
                      note: stockNote,
                    },
                    `Updated inventory for ${stockModal.name}`
                  );
                  if (ok) setStockModal(null);
                }}
                className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Save Stock Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DISH MODAL (OWNER / MANAGER) */}
      {editingDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Edit Dish: {editingDish.name}
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Update dish details, pricing, and photo. Changes reflect live on the digital menu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDish(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDish} className="mt-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Dish Name (Guarded against duplicates)
                </label>
                <input
                  type="text"
                  required
                  value={editDishName}
                  onChange={(e) => setEditDishName(e.target.value)}
                  placeholder="e.g. Butter Chicken"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDishDesc}
                  onChange={(e) => setEditDishDesc(e.target.value)}
                  placeholder="Short appetizing description..."
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#C2410C]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editDishPrice}
                    onChange={(e) => setEditDishPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#C2410C]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Category
                  </label>
                  <select
                    value={editDishCat}
                    onChange={(e) => setEditDishCat(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs outline-none focus:border-[#C2410C]"
                  >
                    {(data?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Dietary
                  </label>
                  <select
                    value={editDishDiet}
                    onChange={(e) => setEditDishDiet(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs outline-none focus:border-[#C2410C]"
                  >
                    <option value="veg">Veg</option>
                    <option value="non_veg">Non-Veg</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
              </div>

              {/* Photo Upload & Preview */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Dish Photo
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-stone-200 bg-stone-50/70 p-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={editDishImageUrl || editingDish.image_url || "/dishes/black-dal.jpg"}
                      alt="Dish preview"
                      className="h-12 w-12 rounded-xl object-cover border border-stone-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/dishes/black-dal.jpg";
                      }}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50">
                      <Upload className="h-3.5 w-3.5 text-stone-500" strokeWidth={1.75} />
                      {isUploadingEditImage ? "Uploading..." : "Change Photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        disabled={isUploadingEditImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleEditImageFileUpload(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="relative min-w-[200px] flex-1">
                    <input
                      type="text"
                      value={editDishImageUrl}
                      onChange={(e) => setEditDishImageUrl(e.target.value)}
                      placeholder="Or enter image URL (https://... or /dishes/...)"
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C2410C]"
                    />
                  </div>
                  {editImageErr && (
                    <p className="w-full text-xs font-medium text-rose-600">{editImageErr}</p>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-stone-400">
                  Leave photo untouched to keep existing image.
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  disabled={isSavingEditDish}
                  onClick={() => setEditingDish(null)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditDish || isUploadingEditImage}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-50"
                >
                  {isSavingEditDish ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
