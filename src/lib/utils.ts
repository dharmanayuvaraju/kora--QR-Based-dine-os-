import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OrderItemStatus, OrderStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol = "₹"): string {
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatElapsed(isoTimestamp: string, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(isoTimestamp).getTime()) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatTimeShort(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const ORDER_STATUS_META: Record<
  OrderStatus | OrderItemStatus,
  {
    label: string;
    shortLabel: string;
    tone: "amber" | "blue" | "orange" | "emerald" | "slate" | "rose";
  }
> = {
  pending_approval: {
    label: "Awaiting Chef Approval",
    shortLabel: "Pending Chef",
    tone: "amber",
  },
  accepted: {
    label: "Accepted by Kitchen",
    shortLabel: "Accepted",
    tone: "blue",
  },
  preparing: {
    label: "Cooking in Kitchen",
    shortLabel: "Preparing",
    tone: "orange",
  },
  ready: {
    label: "Ready for Pickup",
    shortLabel: "Ready",
    tone: "emerald",
  },
  served: {
    label: "Served at Table",
    shortLabel: "Served",
    tone: "slate",
  },
  completed: {
    label: "Completed & Billed",
    shortLabel: "Completed",
    tone: "slate",
  },
  rejected: {
    label: "Rejected by Chef",
    shortLabel: "Rejected",
    tone: "rose",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "Cancelled",
    tone: "rose",
  },
};
