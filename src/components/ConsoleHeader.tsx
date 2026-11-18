"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  ClipboardList,
  LogOut,
  QrCode,
  Store,
  UserCheck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConsoleHeaderProps {
  user: User;
  connected: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  onLogout: () => void;
  theme?: "light" | "dark";
  subtitle: string;
}

const ROUTES = [
  { href: "/chef", label: "Kitchen KDS", icon: ChefHat },
  { href: "/staff", label: "Floor Staff", icon: UserCheck },
  { href: "/manager", label: "Manager", icon: ClipboardList },
  { href: "/owner", label: "Owner", icon: Store },
  { href: "/customer", label: "Customer QR", icon: QrCode },
];

export function ConsoleHeader({
  user,
  connected,
  muted,
  onToggleMute,
  onLogout,
  theme = "light",
  subtitle,
}: ConsoleHeaderProps) {
  const pathname = usePathname();
  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b backdrop-blur-md",
        isDark
          ? "border-zinc-800/90 bg-[#0C0E12]/90 text-zinc-100"
          : "border-stone-200/90 bg-white/90 text-stone-900"
      )}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2410C] text-white shadow-xs">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <span className="font-serif text-base font-semibold tracking-tight">
                KORA
              </span>
              <span
                className={cn(
                  "block text-[10px] font-medium uppercase tracking-[0.14em]",
                  isDark ? "text-zinc-400" : "text-stone-500"
                )}
              >
                {subtitle}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {ROUTES.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                    active
                      ? isDark
                        ? "bg-zinc-800 text-white"
                        : "bg-stone-900 text-white"
                      : isDark
                      ? "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              connected
                ? isDark
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
                : isDark
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {connected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {connected ? "Live Sync" : "Reconnecting"}
            </span>
          </span>

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                isDark
                  ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              )}
              title={muted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className="hidden md:inline">{muted ? "Muted" : "Audio On"}</span>
            </button>
          )}

          <div
            className={cn(
              "hidden items-center gap-2 rounded-lg border px-2.5 py-1 sm:flex",
              isDark
                ? "border-zinc-800 bg-zinc-900/70"
                : "border-stone-200 bg-stone-50"
            )}
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold">{user.full_name}</p>
              <p
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider",
                  isDark ? "text-amber-400" : "text-[#C2410C]"
                )}
              >
                {user.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
              isDark
                ? "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                : "border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            )}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
