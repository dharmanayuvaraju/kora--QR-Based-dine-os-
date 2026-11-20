export type UserRole = "owner" | "manager" | "staff" | "chef";

export type TableStatus = "available" | "occupied" | "inactive";
export type SessionStatus = "active" | "payment_pending" | "closed";

export type OrderStatus =
  | "pending_approval"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "rejected"
  | "cancelled";

export type OrderItemStatus =
  | "pending_approval"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "online" | "counter";
export type PaymentChannel = "upi" | "card" | "cash" | "counter_upi" | "pos_card";
export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type DietaryType = "veg" | "non_veg" | "vegan" | "egg";

export const REJECTION_REASONS = [
  "Item unavailable",
  "Ingredient unavailable",
  "Kitchen overloaded",
  "Preparation not possible",
] as const;

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  section: string;
  qr_token: string;
  capacity: number;
  status: TableStatus;
  is_active: boolean;
  created_at: string;
}

export interface TableSession {
  id: string;
  table_id: string;
  status: SessionStatus;
  guest_count: number;
  bill_requested_at: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
}

export interface TableAssignment {
  id: string;
  table_id: string;
  staff_id: string;
  assigned_by: string | null;
  is_active: boolean;
  assigned_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
}

export interface MenuItemAddonOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  dietary: DietaryType;
  spice_level: 0 | 1 | 2 | 3;
  prep_minutes: number;
  image_url: string;
  is_bestseller: boolean;
  is_available: boolean;
  stock_count: number;
  deleted_at: string | null;
  variants: MenuItemVariant[];
  addons: MenuItemAddonOption[];
}

export interface LowStockFlag {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  current_stock_count: number;
  note: string;
  flagged_by_id: string;
  flagged_by_name: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_name_snapshot: string;
  addon_price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  variant_name_snapshot: string | null;
  quantity: number;
  unit_price: number;
  item_total: number;
  status: OrderItemStatus;
  instructions: string | null;
  addons: OrderItemAddon[];
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  served_by: string | null;
}

export interface Order {
  id: string;
  session_id: string;
  table_id: string;
  table_number: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  total_amount: number;
  special_instructions: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  approved_by: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface KitchenTicket {
  id: string;
  order_id: string;
  order_item_id: string;
  chef_id: string | null;
  status: "queued" | "preparing" | "ready" | "picked_up" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface OrderStatusLog {
  id: string;
  order_id: string;
  order_item_id: string | null;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  session_id: string;
  table_number: string;
  amount: number;
  method: PaymentMethod;
  channel: PaymentChannel;
  status: PaymentStatus;
  receipt_number: string;
  collected_by: string | null;
  collected_by_name: string | null;
  idempotency_key: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  gateway: "razorpay";
  gateway_order_id: string;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  gateway_event_id: string | null;
  signature_verified: boolean;
  created_at: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: "pending" | "processed" | "failed";
  authorized_by: string;
  authorized_by_name: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  cost_per_unit: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  movement_type: "restock" | "deduction" | "wastage" | "adjustment";
  quantity_delta: number;
  note: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  category: "ingredients" | "utilities" | "staff" | "maintenance" | "marketing" | "other";
  amount: number;
  expense_date: string;
  recorded_by: string;
  created_at: string;
}

export interface RestaurantSettings {
  name: string;
  tagline: string;
  address: string;
  gstin: string;
  tax_rate_percent: number;
  service_charge_percent: number;
  currency_symbol: string;
  updated_at: string;
}

export interface SessionBillSummary {
  session_id: string;
  table_id: string;
  table_number: string;
  session_status: SessionStatus;
  bill_requested_at: string | null;
  opened_at: string;
  orders: Order[];
  line_items: Array<{
    order_number: number;
    item_name: string;
    variant_name: string | null;
    addons: string[];
    quantity: number;
    unit_price: number;
    item_total: number;
    status: OrderItemStatus;
  }>;
  subtotal: number;
  tax_rate_percent: number;
  tax_amount: number;
  service_charge_percent: number;
  service_charge: number;
  grand_total: number;
  amount_paid: number;
  refunded_amount: number;
  balance_due: number;
  payment_state: "unpaid" | "partially_paid" | "paid";
  payments: Payment[];
}

export interface PasswordResetRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: "pending" | "resolved";
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface RealtimeEvent {
  id: string;
  type:
    | "order.created"
    | "order.accepted"
    | "order.rejected"
    | "order.cancelled"
    | "item.preparing"
    | "item.ready"
    | "item.served"
    | "bill.requested"
    | "payment.completed"
    | "payment.refunded"
    | "session.opened"
    | "session.closed"
    | "menu.updated"
    | "table.updated"
    | "inventory.updated"
    | "auth.password_reset_requested";
  channel: string;
  session_id?: string;
  table_number?: string;
  order_number?: number;
  message: string;
  timestamp: string;
}

export interface DatabaseState {
  next_order_number: number;
  next_receipt_seq: number;
  settings: RestaurantSettings;
  users: User[];
  restaurant_tables: RestaurantTable[];
  table_sessions: TableSession[];
  table_assignments: TableAssignment[];
  menu_categories: MenuCategory[];
  menu_items: MenuItem[];
  orders: Order[];
  kitchen_tickets: KitchenTicket[];
  order_status_logs: OrderStatusLog[];
  payments: Payment[];
  payment_transactions: PaymentTransaction[];
  refunds: Refund[];
  inventory_items: InventoryItem[];
  inventory_movements: InventoryMovement[];
  low_stock_flags: LowStockFlag[];
  expenses: Expense[];
  audit_logs: AuditLog[];
  password_reset_requests?: PasswordResetRequest[];
}
