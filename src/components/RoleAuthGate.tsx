"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  KeyRound,
  LogOut,
  ShieldCheck,
  Store,
  UserCheck,
  UtensilsCrossed,
} from "lucide-react";
import type { User, UserRole } from "@/lib/types";

interface RoleAuthGateProps {
  requiredRoles: UserRole[];
  preferredRole: UserRole;
  theme?: "light" | "dark";
  children: (ctx: {
    user: User;
    logout: () => Promise<void>;
    switchRole: (role: UserRole) => Promise<void>;
  }) => React.ReactNode;
}

const ROLE_META: Record<
  UserRole,
  { label: string; email: string; desc: string; route: string }
> = {
  owner: {
    label: "Owner",
    email: "owner@kora.in",
    desc: "Business analytics, menu pricing, QR studio, taxes & audit logs",
    route: "/owner",
  },
  manager: {
    label: "Manager",
    email: "manager@kora.in",
    desc: "Live floor plan, staff assignments, refunds & stock alerts",
    route: "/manager",
  },
  chef: {
    label: "Head Chef",
    email: "chef@kora.in",
    desc: "Kitchen approval queue, item-level prep & readiness KDS",
    route: "/chef",
  },
  staff: {
    label: "Floor Staff",
    email: "staff@kora.in",
    desc: "Ready-to-serve alerts, table service & counter collections",
    route: "/staff",
  },
};

export function RoleAuthGate({
  requiredRoles,
  preferredRole,
  theme = "light",
  children,
}: RoleAuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(ROLE_META[preferredRole].email);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const loginWithPayload = async (payload: { email?: string; role?: UserRole }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        return;
      }
      setUser(data.user);
    } catch {
      setError("Network error during sign-in.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
  };

  const switchRole = async (role: UserRole) => {
    await loginWithPayload({ role });
  };

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${
          theme === "dark" ? "bg-[#0C0E12] text-zinc-400" : "bg-[#F6F7F8] text-stone-500"
        }`}
      >
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#C2410C]" />
          Verifying workspace session...
        </div>
      </div>
    );
  }

  const authorized = user && requiredRoles.includes(user.role);

  if (!authorized) {
    const isDark = theme === "dark";
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center p-6 ${
          isDark ? "bg-[#0C0E12] text-zinc-100" : "bg-[#FAF7F2] text-stone-900"
        }`}
      >
        <div
          className={`w-full max-w-md rounded-2xl border p-7 shadow-sm ${
            isDark
              ? "border-zinc-800 bg-[#151921]"
              : "border-stone-200/90 bg-white"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C2410C] text-white">
                <UtensilsCrossed className="h-4 w-4" />
              </span>
              <div>
                <p className="font-serif text-lg font-semibold leading-none tracking-tight">
                  KORA OS
                </p>
                <p
                  className={`mt-1 text-[11px] uppercase tracking-widest ${
                    isDark ? "text-zinc-400" : "text-stone-500"
                  }`}
                >
                  Staff Authorization
                </p>
              </div>
            </Link>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isDark
                  ? "bg-zinc-800 text-zinc-300"
                  : "bg-stone-100 text-stone-700"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#C2410C]" />
              RBAC Protected
            </span>
          </div>

          {user && !requiredRoles.includes(user.role) && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold">
                Signed in as {user.full_name} ({user.role.toUpperCase()})
              </p>
              <p className="mt-1 opacity-90">
                This console requires{" "}
                <span className="font-semibold">
                  {requiredRoles.map((r) => r.toUpperCase()).join(" / ")}
                </span>{" "}
                permission. Switch role below or sign out.
              </p>
              <button
                type="button"
                onClick={logout}
                className="mt-2 inline-flex items-center gap-1 font-medium underline"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginWithPayload({ email });
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="staff-email"
                className={`mb-1.5 block text-xs font-medium ${
                  isDark ? "text-zinc-300" : "text-stone-700"
                }`}
              >
                Employee Email
              </label>
              <div className="relative">
                <KeyRound
                  className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                    isDark ? "text-zinc-500" : "text-stone-400"
                  }`}
                />
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none transition ${
                    isDark
                      ? "border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-[#C2410C]"
                      : "border-stone-200 bg-stone-50 text-stone-900 focus:border-[#C2410C] focus:bg-white"
                  }`}
                  placeholder="name@kora.in"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#C2410C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:opacity-60"
            >
              {submitting
                ? "Authenticating..."
                : `Sign in to ${ROLE_META[preferredRole].label} Console`}
            </button>
          </form>

          <div className="mt-6 border-t border-stone-200/20 pt-5">
            <p
              className={`mb-3 text-[11px] font-semibold uppercase tracking-wider ${
                isDark ? "text-zinc-400" : "text-stone-500"
              }`}
            >
              Quick Role Access (Signed Cookie Session)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {requiredRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={submitting}
                  onClick={() => loginWithPayload({ role })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                    isDark
                      ? "border-zinc-700/80 bg-zinc-900/60 hover:border-zinc-500"
                      : "border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-100/70"
                  }`}
                >
                  {role === "chef" ? (
                    <ChefHat className="h-4 w-4 text-amber-500" />
                  ) : role === "owner" ? (
                    <Store className="h-4 w-4 text-[#C2410C]" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold capitalize">{role}</p>
                    <p className="truncate text-[10px] opacity-65">
                      {ROLE_META[role].email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children({ user, logout, switchRole })}</>;
}
