"use client";

import { cn, ORDER_STATUS_META } from "@/lib/utils";
import type { OrderItemStatus, OrderStatus } from "@/lib/types";

const TONE_STYLES = {
  light: {
    amber: "bg-amber-50 text-amber-800 border-amber-200/80",
    blue: "bg-sky-50 text-sky-800 border-sky-200/80",
    orange: "bg-orange-50 text-orange-800 border-orange-200/80",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    slate: "bg-stone-100 text-stone-700 border-stone-200/80",
    rose: "bg-rose-50 text-rose-800 border-rose-200/80",
  },
  dark: {
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    slate: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};

const DOT_STYLES = {
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  orange: "bg-orange-500",
  emerald: "bg-emerald-500",
  slate: "bg-stone-400",
  rose: "bg-rose-500",
};

export function StatusBadge({
  status,
  variant = "light",
  compact = false,
}: {
  status: OrderStatus | OrderItemStatus;
  variant?: "light" | "dark";
  compact?: boolean;
}) {
  const meta = ORDER_STATUS_META[status];
  const pulsing =
    status === "pending_approval" || status === "preparing" || status === "ready";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE_STYLES[variant][meta.tone]
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              DOT_STYLES[meta.tone]
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            DOT_STYLES[meta.tone]
          )}
        />
      </span>
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
