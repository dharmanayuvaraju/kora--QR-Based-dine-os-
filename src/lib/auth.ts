import crypto from "crypto";
import { cookies } from "next/headers";
import type { User, UserRole } from "./types";

const COOKIE_NAME = "kora_auth_token";
const AUTH_SECRET =
  process.env.AUTH_SECRET || "kora-dev-hmac-secret-change-in-production-32chars";

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signSessionToken(user: User): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getAuthenticatedSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setAuthCookie(user: User): Promise<void> {
  const cookieStore = await cookies();
  const token = signSessionToken(user);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ ok: true; session: SessionPayload } | { ok: false; status: number; error: string }> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { ok: false, status: 401, error: "Authentication required. Please sign in." };
  }
  if (!allowedRoles.includes(session.role)) {
    return {
      ok: false,
      status: 403,
      error: `Access denied. Role '${session.role}' does not have permission for this action.`,
    };
  }
  return { ok: true, session };
}

/**
 * Razorpay HMAC-SHA256 signature creation & constant-time verification
 */
export function computeRazorpaySignature(orderId: string, paymentId: string): string {
  const secret = process.env.RAZORPAY_KEY_SECRET || "kora_demo_razorpay_secret_key";
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = computeRazorpaySignature(orderId, paymentId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET || "kora_demo_webhook_secret";
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
