"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Store,
  UserCheck,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { KoraMark } from "@/components/KoraMark";
import type { User, UserRole } from "@/lib/types";
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

const ROUTES: Array<{
  href: string;
  label: string;
  shortLabel: string;
  role?: UserRole;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { href: "/chef", label: "Kitchen KDS", shortLabel: "KDS", role: "chef", icon: ChefHat },
  { href: "/staff", label: "Floor Staff", shortLabel: "Staff", role: "staff", icon: UserCheck },
  { href: "/manager", label: "Manager", shortLabel: "Manager", role: "manager", icon: ClipboardList },
  { href: "/owner", label: "Owner", shortLabel: "Owner", role: "owner", icon: Store },
  { href: "/", label: "Hub", shortLabel: "Hub", icon: Home },
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 border-b",
          isDark
            ? "border-zinc-800/90 bg-[#0C0E12] text-zinc-100"
            : "border-stone-200/90 bg-white text-stone-900"
        )}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-lg border lg:hidden",
                isDark
                  ? "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700"
                  : "border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
              )}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Menu className="h-4 w-4" strokeWidth={1.75} />}
            </button>

            <Link href="/" className="flex items-center gap-2.5">
              <KoraMark className="h-8 w-8" />
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
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.65} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium sm:px-2.5",
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
                <Wifi className="h-3 w-3" strokeWidth={1.65} />
              ) : (
                <WifiOff className="h-3 w-3" strokeWidth={1.65} />
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
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition sm:px-2.5",
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                    : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                )}
                title={muted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5 text-rose-500" strokeWidth={1.65} />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.65} />
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
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.65} />
            </button>
          </div>
        </div>

        {/* Mobile Hamburger Drawer */}
        {menuOpen && (
          <div
            className={cn(
              "border-t px-4 py-3 lg:hidden",
              isDark
                ? "border-zinc-800 bg-[#12151C] text-zinc-100"
                : "border-stone-200 bg-white text-stone-900"
            )}
          >
            <div className="mb-3 flex items-center justify-between rounded-xl border border-stone-200/20 px-3 py-2 text-xs">
              <div>
                <p className="font-semibold">{user.full_name}</p>
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    isDark ? "text-amber-400" : "text-[#C2410C]"
                  )}
                >
                  Signed in as {user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600/15 px-2.5 py-1 text-[11px] font-semibold text-rose-500"
              >
                <LogOut className="h-3 w-3" strokeWidth={1.65} /> Sign out
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ROUTES.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                const isOwnRole = !item.role || item.role === user.role;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                      active
                        ? isDark
                          ? "border-amber-500/40 bg-zinc-800 text-white"
                          : "border-stone-900 bg-stone-900 text-white"
                        : isDark
                        ? "border-zinc-800 bg-zinc-900/60 text-zinc-300"
                        : "border-stone-200 bg-stone-50 text-stone-700"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.65} />
                      {item.label}
                    </span>
                    {!isOwnRole && (
                      <span className="text-[10px] opacity-60">Role</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Fixed Bottom Navigation Bar for Staff Consoles */}
      <nav
        aria-label="Mobile console navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t lg:hidden",
          isDark
            ? "border-zinc-800 bg-[#0C0E12] text-zinc-300"
            : "border-stone-200 bg-white text-stone-600"
        )}
      >
        <div className="grid grid-cols-5">
          {ROUTES.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition",
                  active
                    ? isDark
                      ? "text-amber-400"
                      : "text-[#C2410C]"
                    : isDark
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.65} />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
