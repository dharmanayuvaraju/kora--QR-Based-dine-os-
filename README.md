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

- **Owner:** `owner@kora.in` (Password: `Owner#kora`)
- **Manager:** `manager@kora.in` (Password: `KoraManager#2026`)
- **Chef:** `chef@kora.in` (Password: `KoraChef#2026`)
- **Floor Staff:** `staff@kora.in` / `ananya@kora.in` (Password: `KoraStaff#2026`)

### Restaurant Owner Account Provisioning (A3Y Ops Only)

To preserve enterprise security, KORA implements zero public self-signup. Restaurant Owner accounts are provisioned exclusively by A3Y Operations directly in the Supabase backend.

**Account Provisioning Hierarchy:**
1. **Owner Accounts:** Created exclusively by A3Y platform administrators in Supabase Auth & PostgreSQL. No public registration route exists.
2. **Owner Console (`/owner` → "Employees & Roles"):** The Owner provisions accounts for Managers, Chefs, and Staff. The Owner defines the employee's full name, User ID (email), and initial password directly without invitation emails or email confirmation barriers.
3. **Manager Console (`/manager` → "Staff & Chefs"):** Managers can provision Staff (Waiters) and Chefs only. The role dropdown restricts selection to Staff and Chef, and `/api/v1/users` enforces this server-side (returning `403 Forbidden` if a manager attempts to provision another manager or an owner).
4. **Staff & Chef Consoles:** Cannot provision accounts (all creation routes blocked).

**A3Y Onboarding Script (Run in Supabase SQL Editor):**
```sql
-- Step 1: Create the Owner in Supabase Auth with pre-confirmed email
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'owner@restaurant.in', -- Restaurant owner email
  crypt('TemporaryPassword#123', gen_salt('bf')), -- Strong initial password
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"],"role":"owner"}'::jsonb,
  '{"full_name":"Restaurant Owner Name","email_verified":true}'::jsonb,
  FALSE,
  NOW(),
  NOW()
)
RETURNING id;

-- Step 2: Insert into auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
  'email',
  id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'owner@restaurant.in';

-- Step 3: Register in public.users table
INSERT INTO public.users (
  id,
  full_name,
  email,
  role,
  phone,
  is_active
)
SELECT
  id,
  raw_user_meta_data->>'full_name',
  email,
  'owner',
  '+91 98000 00000',
  TRUE
FROM auth.users
WHERE email = 'owner@restaurant.in'
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE;
```

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
