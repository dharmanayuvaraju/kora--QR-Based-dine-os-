# KORA — Single-Restaurant QR Ordering & Hospitality OS

A single responsive full-stack Next.js (App Router + TypeScript + Tailwind CSS) application delivering all five restaurant surfaces with server-authoritative pricing, item-level Kitchen Display System (KDS), real-time updates, combined table billing, dual-mode Razorpay + Counter payments, and production Supabase PostgreSQL SQL migrations.

## Application Surfaces

| Route | Role / Audience | Highlights |
|---|---|---|
| `/` | Platform Command Hub | Live real-time service telemetry + permanent QR directory for Tables 01–08 |
| `/customer` & `/menu/t/[token]` | Diners (Zero Login) | Permanent unguessable table QR tokens, dish variants & add-ons, live item-level order tracker, combined session bill, Razorpay UPI/Card & Pay at Counter, printable GST receipt |
| `/chef` | Head Chef (KDS) | Industrial dark low-glare KDS, 3-column workflow (Pending Approval → Preparing → Ready at Pass), rejection reason capture, independent item-level prep/ready buttons, 86 item availability toggle, audio bell |
| `/staff` | Floor Staff / Waiters | Real-time ready-to-serve pickup queue with chime alerts, 1-tap Mark Served (strictly enforces READY → SERVED), assigned tables, bill request alerts & counter cash/UPI/POS collection |
| `/manager` | Restaurant Manager | Live floor plan, staff-to-table assignment, order cancellation & refunds (audit logged), stock adjustment, staff/chef account management |
| `/owner` | Restaurant Owner | Revenue & payment channel analytics, full menu & pricing studio, tabletop QR code standee generator/printer, expenses & P&L, employee & role management, immutable audit logs, GST settings |

## Demo Employee Accounts (Signed HTTP-Only Cookie RBAC)

- **Owner:** `owner@kora.in`
- **Manager:** `manager@kora.in`
- **Chef:** `chef@kora.in`
- **Floor Staff:** `staff@kora.in` / `ananya@kora.in`

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Dual-Mode Production Setup (Supabase + Razorpay)

1. Copy `.env.example` to `.env.local` and populate your Supabase & Razorpay keys.
2. Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor to provision all 18 core tables, partial unique indexes (`one_active_session_per_table`), Row Level Security (RLS) policies, and Realtime publications.
3. Point Razorpay webhooks to `POST /api/v1/payments/razorpay/webhook` (HMAC-SHA256 verified with idempotency protection).
