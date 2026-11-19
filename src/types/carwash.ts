export type StaffRole =
  | 'washer'
  | 'detailer'
  | 'cashier'
  | 'inventory_manager'
  | 'supervisor';

export type VehicleTier = 'sedan' | 'suv' | '4x4' | 'van';

export type InvoiceType = 'service' | 'retail';

export type InvoiceStatus =
  | 'pending'
  | 'washing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'instapay';

export type PricingMode = 'markup_percent' | 'markup_fixed' | 'manual';

export type DiscountType = 'none' | 'percent' | 'fixed';

export type StockMovementType =
  | 'restock'
  | 'sale'
  | 'wash_usage'
  | 'adjustment';

export interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  role_title_ar: string;
  phone: string;
  commission_rate: number; // Percentage (e.g., 10 for 10%)
  base_salary: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface WashService {
  id: string;
  code: string;
  name_ar: string;
  category: string;
  duration_minutes: number;
  price_sedan: number;
  price_suv: number;
  price_4x4: number;
  price_van: number;
  vat_applicable: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name_ar: string;
  brand: string;
  category: string;
  unit: string;
  cost_price: number;
  pricing_mode: PricingMode;
  markup_value: number; // % if markup_percent, EGP if markup_fixed, 0 if manual
  selling_price: number; // Pre-VAT selling price
  stock_qty: number;
  min_stock_alert: number;
  supplier_name: string;
  is_for_sale: boolean;
  is_consumable: boolean;
  vat_applicable: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  car_model: string;
  car_plate: string;
  vehicle_tier: VehicleTier;
  notes?: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_type: 'service' | 'product';
  service_id?: string | null;
  product_id?: string | null;
  item_name: string;
  unit_cost: number;
  unit_price: number; // Pre-VAT unit price
  quantity: number;
  line_discount: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string; // SRV-2026-0001 or RTL-2026-0001
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  car_model?: string | null;
  car_plate?: string | null;
  vehicle_tier?: VehicleTier | null;
  wash_bay?: string | null;
  created_by_staff_id: string; // Cashier / Issuer (e.g., محمود كمال)
  performed_by_staff_id?: string | null; // Washer / Detailer / Seller (e.g., أحمد مجدي)
  completed_by_staff_id?: string | null; // Who closed / handed over
  subtotal: number; // Sum of line totals before invoice discount & VAT
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  taxable_amount: number; // subtotal - discount_amount
  vat_rate: number; // 14 for Egypt
  vat_amount: number;
  total_amount: number; // taxable_amount + vat_amount
  total_cost: number;
  net_profit: number;
  notes?: string;
  items: InvoiceItem[];
  created_at: string;
  completed_at?: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: StockMovementType;
  quantity_change: number; // Positive for restock, negative for sale/usage
  unit_cost: number;
  reference_invoice_id?: string | null;
  performed_by_staff_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  business_name: string;
  branch_name: string;
  tax_registration_no: string;
  vat_rate: number; // Default 14
  access_passcode: string; // Default 12345678
  address: string;
  phone: string;
  receipt_footer_service: string;
  receipt_footer_retail: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
