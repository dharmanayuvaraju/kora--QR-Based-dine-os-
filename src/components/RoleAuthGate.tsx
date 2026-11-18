"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { KoraMark } from "@/components/KoraMark";
import type { User, UserRole } from "@/lib/types";

interface RoleAuthGateProps {
  requiredRoles: UserRole[];
  preferredRole: UserRole;
  theme?: "light" | "dark";
  children: (ctx: {
    user: User;
    logout: () => Promise<void>;
  }) => React.ReactNode;
}

const ROLE_META: Record<UserRole, { label: string; route: string }> = {
  owner: { label: "Owner", route: "/owner" },
  manager: { label: "Manager", route: "/manager" },
  chef: { label: "Head Chef", route: "/chef" },
  staff: { label: "Floor Staff", route: "/staff" },
};

export function RoleAuthGate({
  requiredRoles,
  preferredRole,
  theme = "light",
  children,
}: RoleAuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid email or password.");
        return;
      }
      setPassword("");
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
    setEmail("");
    setPassword("");
    setError(null);
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
          Verifying staff session...
        </div>
      </div>
    );
  }

  const authorized = user && requiredRoles.includes(user.role);

  if (!authorized) {
    const isDark = theme === "dark";
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center p-5 ${
          isDark ? "bg-[#0C0E12] text-zinc-100" : "bg-[#FAF7F2] text-stone-900"
        }`}
      >
        <div
          className={`w-full max-w-md rounded-2xl border p-6 shadow-sm sm:p-7 ${
            isDark
              ? "border-zinc-800 bg-[#151921]"
              : "border-stone-200/90 bg-white"
          }`}
        >
          <div className="mb-6 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2.5">
              <KoraMark className="h-9 w-9" />
              <div>
                <p className="font-serif text-lg font-semibold leading-none tracking-tight">
                  KORA OS
                </p>
                <p
                  className={`mt-1 text-[11px] uppercase tracking-widest ${
                    isDark ? "text-zinc-400" : "text-stone-500"
                  }`}
                >
                  {ROLE_META[preferredRole].label} Sign In
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
              <ShieldCheck className="h-3.5 w-3.5 text-[#C2410C]" strokeWidth={1.65} />
              Role Gated
            </span>
          </div>

          {user && !requiredRoles.includes(user.role) ? (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 text-xs ${
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={1.65} />
                  Access Restricted
                </p>
                <p className="mt-1.5 leading-relaxed opacity-90">
                  You are signed in as <strong>{user.full_name}</strong> (
                  <span className="uppercase">{user.role}</span>). This console is
                  restricted to{" "}
                  <strong>
                    {requiredRoles.map((r) => ROLE_META[r].label).join(" / ")}
                  </strong>{" "}
                  accounts only.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <Link
                  href={ROLE_META[user.role].route}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C2410C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#9A3412]"
                >
                  Open My {ROLE_META[user.role].label} Console
                  <ArrowRight className="h-4 w-4" strokeWidth={1.65} />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition ${
                    isDark
                      ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      : "border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.65} />
                  Sign out to log in with a different role
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4" autoComplete="on">
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
                  <Mail
                    className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                      isDark ? "text-zinc-500" : "text-stone-400"
                    }`} strokeWidth={1.65}
                  />
                  <input
                    id="staff-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none transition ${
                      isDark
                        ? "border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-[#C2410C]"
                        : "border-stone-200 bg-stone-50 text-stone-900 focus:border-[#C2410C] focus:bg-white"
                    }`}
                    placeholder="you@kora.in"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className={`mb-1.5 block text-xs font-medium ${
                    isDark ? "text-zinc-300" : "text-stone-700"
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                      isDark ? "text-zinc-500" : "text-stone-400"
                    }`} strokeWidth={1.65}
                  />
                  <input
                    id="staff-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full rounded-xl border py-2.5 pr-10 pl-9 text-sm outline-none transition ${
                      isDark
                        ? "border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-[#C2410C]"
                        : "border-stone-200 bg-stone-50 text-stone-900 focus:border-[#C2410C] focus:bg-white"
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className={`absolute top-1/2 right-3 -translate-y-1/2 ${
                      isDark ? "text-zinc-400 hover:text-zinc-200" : "text-stone-400 hover:text-stone-700"
                    }`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.65} /> : <Eye className="h-4 w-4" strokeWidth={1.65} />}
                  </button>
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
                  ? "Signing in..."
                  : `Sign in as ${ROLE_META[preferredRole].label}`}
              </button>

              <p
                className={`pt-2 text-center text-[11px] ${
                  isDark ? "text-zinc-500" : "text-stone-500"
                }`}
              >
                Authenticated via Supabase Auth · Each employee can only access their assigned role console.
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children({ user, logout })}</>;
}
