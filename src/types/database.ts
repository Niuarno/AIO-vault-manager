export type UserRole = 'admin' | 'sales' | 'packing';

export type OrderSource = 'website' | 'messenger' | 'whatsapp' | 'phone' | 'manual';

export type OrderStatus =
  | 'pending'
  | 'not_reachable'
  | 'confirmed'
  | 'ready_to_ship'
  | 'on_the_way'
  | 'shipped'
  | 'delivered'
  | 'canceled';

export type RewardRuleType = 'percentage' | 'fixed_per_order' | 'fixed_per_item';

export type RewardStatus = 'pending' | 'approved' | 'paid';

export type InventoryReason =
  | 'order_created'
  | 'order_confirmed'
  | 'order_canceled'
  | 'manual_adjustment'
  | 'restock';

export interface PaymentInfo {
  method?: 'bkash' | 'nagad' | 'rocket' | 'bank' | string;
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  branch_name?: string;
  routing_number?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  coupon_code: string | null;
  bio: string | null;
  is_active: boolean;
  is_online?: boolean;
  payment_info?: PaymentInfo | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutRequest {
  id: string;
  staff_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  payment_method: string;
  account_number: string;
  staff_note?: string | null;
  admin_screenshot_url?: string | null;
  admin_note?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at?: string;
  staff?: Profile;
}

export interface Product {
  id: string;
  title: string;
  handle: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  price: number;
  cost_price?: number | null;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: number;
  is_upsell: boolean;
  is_reachout?: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: string;
  payment_method: string;
  payment_status: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  sales_rep_id: string | null;
  coupon_used: string | null;
  note: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  sales_rep?: Profile | null;
  original_items?: any;
  edit_history?: any[];
  courier_name?: string | null;
  consignment_id?: string | null;
  tracking_code?: string | null;
  tracking_message?: string | null;
  courier_status?: string | null;
  courier_updated_at?: string | null;
  delivery_charge?: number | null;
}

export interface RewardRule {
  id: string;
  name: string;
  rule_type: RewardRuleType;
  value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsellReward {
  id: string;
  sales_rep_id: string;
  order_id: string;
  order_item_id: string | null;
  bonus_amount: number;
  status: RewardStatus;
  note: string | null;
  created_at: string;
  order?: Order;
}

export interface InventoryLog {
  id: string;
  variant_id: string;
  previous_stock: number;
  change_amount: number;
  new_stock: number;
  reason: InventoryReason;
  order_id: string | null;
  adjusted_by: string | null;
  created_at: string;
  variant?: ProductVariant;
}
