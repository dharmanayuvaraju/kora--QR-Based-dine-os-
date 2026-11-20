# KORA — QR-Based Dine-In Restaurant Operating System

A responsive full-stack Next.js (App Router, TypeScript, Tailwind CSS) hospitality platform powering five interconnected restaurant surfaces with server-authoritative pricing, real-time item-level Kitchen Display System (KDS), rotating table session security, dual-mode Razorpay + Counter payments, and automated audit logging.

**Location:** Hyderabad Bistro — Road No. 36, Jubilee Hills, Hyderabad 500033  
**GSTIN:** `36AABCK4821M1Z5`  
**Restaurant Owner:** Yuvaraj (`owner@kora.in`)

---

## Recent Updates & Upgrades

### 1. Table Session Security & Rotating QR Tokens
- **Dynamic Session Security:** Table QR codes encode an unguessable rotating session token (`crypto.randomUUID()`) rather than static table numbers.
- **Session Lifecycle Gate:** A table must be explicitly opened by floor staff or management when guests are seated. Scanning an unopened or closed table displays an inactive session notice, blocking any rogue or remote orders.
- **Photographed QR Invalidation:** When a table bill is settled or the table is cleared, clicking **"Close Table"** immediately terminates the session and generates a fresh rotating QR token. Previously photographed QR standees become permanently invalid.
- **Floor Session Telemetry:** Live floor views on Staff and Owner consoles display real-time session badges: `SESSION OPEN`, `PAYMENT PENDING`, or `SESSION CLOSED / AVAILABLE`.

### 2. Order Approval Gate & Suspicious Order Guard
- **Pre-Cook Approval Pipeline:** All customer orders initially land in `pending_approval` status (the **"NEW ORDERS"** queue on KDS and Staff overview). Nothing is prepped or cooked until approved.
- **Mandatory Rejection Reasons:** Staff and Chefs can reject suspicious or erroneous orders with a mandatory reason modal.
- **Diner Live Alerts:** Diners immediately see: *"Order could not be accepted, please check with our staff. Reason: [reason]"*.
- **Audit Logging:** Every rejection is recorded in the immutable audit log with actor ID, role, timestamp, order number, and reason.

### 3. Customer Item-Level Cancellation
- **Selective Item Cancel:** Diners can cancel individual items directly from their live order tracker while the item remains in `pending_approval` / placed status.
- **Mandatory Reason Requirement:** Requires a clear cancellation reason before submission.
- **Bill & Ticket Exclusion:** Cancelled items are automatically deducted from the session bill, tax calculations, and kitchen prep queues.
- **Preparation Lockout:** Once an item is accepted into `preparing` or `ready`, customer cancellation is locked out to prevent food wastage.

### 4. Menu Expansion & Soft Drinks
- Added the **Soft Drinks** category with immediate ordering support:
  - **Thums Up (₹45)** — Stock: 60
  - **Pepsi (₹45)** — Stock: 60
  - **Water Bottle (₹25)** — Stock: 100
- Full stock tracking, real-time inventory deduction, and low-stock threshold alerts.

### 5. Dish Photo Studio & Duplicate Guard
- **Image Upload in Add/Edit Dish:** Image picker with preview supporting file uploads to Supabase Storage or direct image URLs.
- **Preserved Dish Imagery:** Editing existing dishes preserves their photos unless deliberately changed.
- **Duplicate Dish Guard:** Case-insensitive duplicate name prevention on both Add and Edit forms (`409 Conflict`), preventing duplicate menu items from accidental double clicks.

### 6. Owner-Only Non-Blocking Employee Deletion
- **Strict Role Isolation:** Permanent employee deletion is strictly owner-only. Managers maintain Disable/Re-enable toggles only; all server-side delete requests by non-owners are rejected with `403 Forbidden`.
- **Atomic Auth & Data Cleanup:** Deleting an employee removes both the Supabase Auth user (`admin.deleteUser`) and the database employee row.
- **Non-Blocking UI:** Async operations execute cleanly with optimistic local state updates and instant toast alerts without blocking the UI thread.
- **Idempotent Seed Safety:** Re-deployments and database migrations preserve existing employee credentials, preventing lockouts.

### 7. Forgot Password & Self-Service Reset Workflow
- **Self-Service Requests:** Added a **"Forgot password?"** link to Manager, Chef, and Floor Staff login pages.
- **Owner Dashboard Alerts:** Requests immediately trigger an unread notification indicator (bell icon) and audit log entry on the Owner Console.
- **Direct Reset by Owner:** The Owner can set a new password directly from the **Employees & Roles** panel, instantly updating Supabase Auth without email dependency.

### 8. Unified Light UI Theme & Navigation
- **Consistent Light Styling:** Re-skinned the Chef login page, Chef KDS dashboard, and the homepage Chef KDS card to the clean white/stone aesthetic (`bg-white`, `#E5DACB` border, refined typography) matching all other restaurant consoles.
- **Role Sign-In Navigation:** Added explicit **"Back to home"** links beneath all role sign-in cards (`/owner`, `/manager`, `/staff`, `/chef`) for seamless switching between consoles.

---

## Application Surfaces

| Route | Role / Surface | Key Capabilities |
|---|---|---|
| `/` | **Platform Command Hub** | Live service telemetry, quick navigation, restaurant location info, and tabletop QR standee directory. |
| `/customer`<br>`/menu/t/[token]` | **Diners (Zero Login)** | Rotating QR security, category filtering, dish photos, item-level order tracker, individual item cancellation, combined session bill, Razorpay UPI/Card & counter payment, and printable GST receipts. |
| `/chef` | **Head Chef (KDS)** | Clean light KDS, 3-column ticket pipeline (New Orders → Preparing → Ready at Pass), order approval/rejection with mandatory reasons, item-level prep controls, 86 item availability toggles, and audio alerts. |
| `/staff` | **Floor Staff / Waiters** | Table session controls (Open/Close table), floor session status indicators, ready-to-serve pickup alerts, 1-tap served confirmations, and counter cash/UPI/card collection. |
| `/manager` | **Restaurant Manager** | Real-time floor plan, waiter-to-table assignments, order cancellation/refunds with audit logs, stock adjustments, and staff/chef provisioning (Disable/Re-enable). |
| `/owner` | **Restaurant Owner (Yuvaraj)** | Gross revenue, payment channels, and AOV analytics; menu studio with dish photo upload & duplicate guards; tabletop QR standee generator; employee provisioning with permanent deletion; forgot password resets; and immutable audit logs. |

---

## Default Employee Accounts

Authentication is managed via signed HTTP-only cookies with server-side role validation:

| Role | Email | Password | Display Name | Permissions |
|---|---|---|---|---|
| **Owner** | `owner@kora.in` | `Owner#kora` | **Yuvaraj** | Full administrative access, menu pricing, employee provisioning & permanent deletion, password resets, financial reports, audit logs. |
| **Manager** | `manager@kora.in` | `KoraManager#2026` | Priya Nair | Floor oversight, waiter assignments, inventory adjustments, order cancellations, staff/chef provisioning & disable/enable. |
| **Chef** | `chef@kora.in` | `KoraChef#2026` | Vikramaditya Rao | KDS workflow, order approval & rejection, item prep transitions, 86-item availability flags. |
| **Floor Staff** | `staff@kora.in`<br>`ananya@kora.in` | `KoraStaff#2026` | Rohan Das<br>Ananya Verma | Table session open/close, order approval/rejection, food pickup & delivery confirmation, counter payments. |

---

## Core Architecture & API Routes

### Table & Session Management
- `GET /api/v1/public/tables/[token]` — Resolves table by dynamic QR token; enforces active session check.
- `POST /api/v1/tables/[id]/session/open` — Opens table session for seated guests and rotates the QR token.
- `POST /api/v1/tables/[id]/session/close` — Closes table session, verifies zero balance due, and rotates QR token to invalidate standee photos.
- `GET /api/v1/tables` — Lists all restaurant tables with active session metadata and current QR tokens.

### Order & Kitchen Pipeline
- `POST /api/v1/public/sessions/[id]/orders` — Places a customer order into `pending_approval` status.
- `POST /api/v1/chef/orders/[id]/accept` — Approves order for kitchen preparation (Chef, Staff, Manager, Owner).
- `POST /api/v1/chef/orders/[id]/reject` — Rejects order with mandatory reason and logs audit event.
- `POST /api/v1/orders/[id]/items/[itemId]/cancel` — Customer item-level cancellation with mandatory reason.
- `POST /api/v1/orders/[id]/cancel` — Whole-order cancellation with mandatory reason (Manager/Owner).
- `POST /api/v1/chef/items/[id]/start` & `ready` — Transitions individual kitchen ticket items.
- `POST /api/v1/staff/items/[id]/served` — Confirms delivery of prepared items to the diner's table.

### Menu & Inventory Management
- `GET /api/v1/public/menu` — Public catalog with category chips, variants, add-ons, and dish photos.
- `POST /api/v1/menu/items` — Adds a menu item with image upload and case-insensitive duplicate check.
- `PUT /api/v1/menu/items/[id]` — Updates an existing dish with image preservation and duplicate check.
- `POST /api/v1/menu/upload-image` — Uploads dish imagery to Supabase Storage.
- `PATCH /api/v1/menu/items/[id]/availability` — Chef toggle for 86ing out-of-stock items.

### User Provisioning & Security
- `POST /api/v1/auth/forgot-password` — Submits a self-service password reset request to the Owner Console.
- `POST /api/v1/users/[id]/reset-password` — Sets an employee's new password directly (Owner only).
- `DELETE /api/v1/users/[id]` — Permanently deletes employee from Supabase Auth and database (Owner only).
- `PATCH /api/v1/users/[id]` — Toggles employee active/disabled status.

---

## Quick Start

### 1. Installation
```bash
git clone https://github.com/dharmanayuvaraju/kora--QR-Based-dine-os-.git
cd kora--QR-Based-dine-os-
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and configure:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Command Hub.

### 4. Production Build & Start
```bash
npm run build
npm run start
```

---

## Quality Control & Testing

KORA includes automated verification suites covering all hospitality workflows:
- **Requirements 10–15 Suite:** `node scratch/run-qc-10-to-15.js` (23 tests — 100% pass)
- **Regression Suite (Reqs 1–9):** `node scratch/run-qc.js` (30 tests — 100% pass)
- Total Coverage: **53 / 53 PASS (100%)**
