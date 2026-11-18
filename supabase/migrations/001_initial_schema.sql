-- ============================================================================
-- KORA Restaurant QR Ordering & Management Platform
-- Production PostgreSQL / Supabase Migration (18 Core Tables + Settings + RLS)
-- Hardened per Supabase Security & Performance Advisors
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS app_private;

-- 1. USERS (Backed by Supabase Auth UUID; no local password_hash stored)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'chef')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RESTAURANT_TABLES
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number TEXT UNIQUE NOT NULL,
  section TEXT NOT NULL DEFAULT 'Main Dining',
  qr_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'inactive')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE_SESSIONS
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'payment_pending', 'closed')),
  guest_count INT DEFAULT 2,
  bill_requested_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_table
  ON public.table_sessions(table_id)
  WHERE status IN ('active', 'payment_pending');
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON public.table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_closed_by ON public.table_sessions(closed_by);

-- 4. TABLE_ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_staff_per_table
  ON public.table_assignments(table_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_table_assignments_staff_id ON public.table_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_assigned_by ON public.table_assignments(assigned_by);

-- 5. MENU_CATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MENU_ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  dietary TEXT NOT NULL DEFAULT 'veg' CHECK (dietary IN ('veg', 'non_veg', 'vegan', 'egg')),
  spice_level INT NOT NULL DEFAULT 1 CHECK (spice_level BETWEEN 0 AND 3),
  prep_minutes INT NOT NULL DEFAULT 15,
  image_url TEXT,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);

-- 7. MENU_ITEM_VARIANTS
CREATE TABLE IF NOT EXISTS public.menu_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_menu_item_variants_item_id ON public.menu_item_variants(menu_item_id);

-- 8. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (
    status IN ('pending_approval', 'accepted', 'preparing', 'ready', 'served', 'completed', 'rejected', 'cancelled')
  ),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  special_instructions TEXT,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON public.orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_approved_by ON public.orders(approved_by);

-- 9. ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  item_total NUMERIC(12,2) NOT NULL CHECK (item_total >= 0),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (
    status IN ('pending_approval', 'accepted', 'preparing', 'ready', 'served', 'rejected', 'cancelled')
  ),
  instructions TEXT,
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  served_by UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_served_by ON public.order_items(served_by);

-- 10. ORDER_ITEM_ADDONS
CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_name_snapshot TEXT NOT NULL,
  addon_price NUMERIC(12,2) NOT NULL CHECK (addon_price >= 0)
);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_item_id ON public.order_item_addons(order_item_id);

-- 11. KITCHEN_TICKETS
CREATE TABLE IF NOT EXISTS public.kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  chef_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'ready', 'picked_up', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_id ON public.kitchen_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_item_id ON public.kitchen_tickets(order_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_chef_id ON public.kitchen_tickets(chef_id);

-- 12. ORDER_STATUS_LOGS
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id),
  actor_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON public.order_status_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_item_id ON public.order_status_logs(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_actor_id ON public.order_status_logs(actor_id);

-- 13. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('online', 'counter')),
  channel TEXT CHECK (channel IN ('upi', 'card', 'cash', 'counter_upi', 'pos_card')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')
  ),
  receipt_number TEXT UNIQUE,
  collected_by UUID REFERENCES public.users(id),
  idempotency_key TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON public.payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_collected_by ON public.payments(collected_by);

-- 14. PAYMENT_TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT NOT NULL,
  gateway_payment_id TEXT UNIQUE,
  gateway_signature TEXT,
  gateway_event_id TEXT UNIQUE,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON public.payment_transactions(payment_id);

-- 15. REFUNDS
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
  authorized_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_authorized_by ON public.refunds(authorized_by);

-- 16. INVENTORY_ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'kg',
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,2) NOT NULL DEFAULT 5,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. INVENTORY_MOVEMENTS
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('restock', 'deduction', 'wastage', 'adjustment')),
  quantity_delta NUMERIC(12,2) NOT NULL,
  note TEXT,
  actor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_actor_id ON public.inventory_movements(actor_id);

-- 18. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- Supporting Tables: RESTAURANT_SETTINGS & EXPENSES
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'KORA Kitchen & Grill',
  tagline TEXT NOT NULL DEFAULT 'Contemporary Indian Bistro',
  address TEXT NOT NULL DEFAULT '42 Indiranagar 100ft Road, Bengaluru 560038',
  gstin TEXT NOT NULL DEFAULT '29AABCK4821M1Z5',
  tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  service_charge_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ingredients', 'utilities', 'staff', 'maintenance', 'marketing', 'other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON public.expenses(recorded_by);

-- Server-managed transactional state store (RLS locked: service_role only)
CREATE TABLE IF NOT EXISTS public.kora_app_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version BIGINT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lightweight Realtime Event Stream for cross-device / serverless live updates
CREATE TABLE IF NOT EXISTS public.kora_realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  session_id TEXT,
  table_number TEXT,
  order_number INT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (ENABLED ON ALL EXPOSED PUBLIC TABLES)
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kora_app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kora_realtime_events ENABLE ROW LEVEL SECURITY;

-- Private schema helper function (never exposed in public Data API)
CREATE OR REPLACE FUNCTION app_private.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid()) AND is_active = TRUE;
$$;

REVOKE ALL ON FUNCTION app_private.current_user_role() FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_user_role() TO authenticated;

-- Public read access for active menu catalog
CREATE POLICY "Public read active categories" ON public.menu_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Public read active menu items" ON public.menu_items
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Public read menu item variants" ON public.menu_item_variants
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Public read restaurant settings" ON public.restaurant_settings
  FOR SELECT TO anon, authenticated
  USING (TRUE);

-- Employees read own profile; Owner/Manager read all
CREATE POLICY "Employees read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR app_private.current_user_role() IN ('owner', 'manager'));

-- Chefs CANNOT access financial payments or audit logs
CREATE POLICY "Non-chef authorized read payments" ON public.payments
  FOR SELECT TO authenticated
  USING (app_private.current_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "Owner and manager read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (app_private.current_user_role() IN ('owner', 'manager'));

-- Realtime notification feed (non-sensitive event pings only; writes via service_role)
GRANT SELECT ON public.kora_realtime_events TO anon, authenticated;
CREATE POLICY "Public subscribe realtime events" ON public.kora_realtime_events
  FOR SELECT TO anon, authenticated
  USING (TRUE);

-- Enable Supabase Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.orders,
  public.order_items,
  public.table_sessions,
  public.restaurant_tables,
  public.payments,
  public.kitchen_tickets,
  public.kora_realtime_events;
