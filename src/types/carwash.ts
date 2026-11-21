export type StaffRole =
  | 'washer'
  | 'detailer'
  | 'cashier'
  | 'inventory_manager'
  | 'supervisor';

export type VehicleTier = 'sedan' | 'suv' | '4x4' | 'van';

export type SaleTier = 'retail' | 'half_wholesale' | 'wholesale';

export type InvoiceType = 'service' | 'retail';

export type InvoiceStatus =
  | 'pending'
  | 'washing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'vodafone_cash'
  | 'instapay'
  | 'deferred'
  | `wallet:${string}`;

export type PricingMode = 'markup_percent' | 'markup_fixed' | 'manual';

export type DiscountType = 'none' | 'percent' | 'fixed';

export type StockMovementType =
  | 'restock'
  | 'sale'
  | 'wash_usage'
  | 'adjustment';

export type ExpenseCategory =
  | 'utilities'
  | 'rent'
  | 'maintenance'
  | 'supplies'
  | 'hospitality'
  | 'salaries'
  | 'other';

export type AppThemeId =
  | 'royal-blue'
  | 'emerald-mint'
  | 'warm-sand'
  | 'sunset-coral'
  | 'slate-dark';

export interface StaffPermissions {
  can_access_pos: boolean;
  can_apply_discount: boolean;
  can_sell_wholesale: boolean;
  can_view_profits: boolean;
  can_manage_inventory: boolean;
  can_manage_purchases: boolean;
  can_manage_expenses: boolean;
  can_close_shift: boolean;
  can_view_reports: boolean;
  can_export_excel: boolean;
  can_manage_settings: boolean;
}

export interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  role_title_ar: string;
  phone: string;
  commission_rate: number; // Percentage (e.g., 10 for 10%)
  base_salary: number;
  is_active: boolean;
  permissions?: StaffPermissions;
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
  barcode?: string;
  name_ar: string;
  brand: string;
  category: string;
  warehouse_name?: string;
  unit: string;
  cost_price: number;
  pricing_mode: PricingMode;
  markup_value: number; // % if markup_percent, EGP if markup_fixed, 0 if manual
  selling_price: number; // Retail (قطاعي) pre-VAT price
  half_wholesale_price?: number; // نص جملة pre-VAT price
  wholesale_price?: number; // جملة pre-VAT price
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
  opening_balance?: number; // Positive = customer owes us
  notes?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company_name?: string;
  address?: string;
  opening_balance: number; // Positive = we owe supplier
  notes?: string;
  created_at: string;
}

export interface WalletAccount {
  id: string;
  name: string;
  provider: string; // Vodafone Cash, InstaPay, Etisalat Cash, Orange Cash, etc.
  account_number: string;
  current_balance: number;
  is_active: boolean;
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
  sale_tier?: SaleTier; // قطاعي / نص جملة / جملة
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  shift_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  car_model?: string | null;
  car_plate?: string | null;
  vehicle_tier?: VehicleTier | null;
  wash_bay?: string | null;
  created_by_staff_id: string;
  performed_by_staff_id?: string | null;
  completed_by_staff_id?: string | null;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  paid_amount?: number; // Defaults to total_amount unless deferred
  total_cost: number;
  net_profit: number;
  notes?: string;
  items: InvoiceItem[];
  created_at: string;
  completed_at?: string | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: string;
  purchase_number: string; // PUR-2026-0001
  supplier_id?: string | null;
  supplier_name: string;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  shift_id?: string | null;
  created_by_staff_id: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  notes?: string;
  items: PurchaseItem[];
  created_at: string;
}

export interface Expense {
  id: string;
  expense_number: string; // EXP-2026-0001
  category: ExpenseCategory;
  title: string;
  amount: number;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  shift_id?: string | null;
  staff_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface PartyPayment {
  id: string;
  party_type: 'customer' | 'supplier';
  party_id: string;
  party_name: string;
  amount: number;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  shift_id?: string | null;
  staff_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface ShiftRecord {
  id: string;
  shift_number: string; // SHF-2026-0001
  cashier_staff_id: string;
  cashier_name: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opening_cash: number;
  cash_sales: number;
  wallet_sales: number;
  card_sales: number;
  deferred_sales: number;
  cash_purchases: number;
  cash_expenses: number;
  customer_cash_collections: number;
  supplier_cash_payments: number;
  expected_cash: number;
  actual_cash?: number | null;
  variance?: number | null; // actual_cash - expected_cash (+ surplus / - shortage)
  notes?: string;
}

export interface PayrollPayout {
  id: string;
  staff_id: string;
  staff_name: string;
  month_label: string;
  base_salary: number;
  commission_amount: number;
  bonuses: number;
  deductions: number;
  net_paid: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: StockMovementType;
  quantity_change: number;
  unit_cost: number;
  reference_invoice_id?: string | null;
  performed_by_staff_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface BackupEntry {
  id: string;
  created_at: string;
  kind: 'auto' | 'manual';
  size_kb: number;
  summary: string;
  payload_json: string;
}

export interface AppSettings {
  id: string;
  business_name: string;
  branch_name: string;
  tax_registration_no: string;
  vat_rate: number;
  access_passcode: string;
  address: string;
  phone: string;
  receipt_footer_service: string;
  receipt_footer_retail: string;
  theme?: AppThemeId;
  auto_backup_enabled?: boolean;
  last_backup_at?: string | null;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
