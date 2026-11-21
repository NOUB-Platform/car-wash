-- ============================================================================
-- نظام بيرفكت | Perfect — إدارة مغسلة السيارات والمخزن والمحاسبة
-- الفرع: أول شارع الهرم، الجيزة — متوافق مع ضريبة 14% (مصر)
-- متوافق بالكامل مع Supabase (PostgreSQL 15+) — آمن للتشغيل المتكرر (Idempotent)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. جدول إعدادات النشاط والضريبة والسيمات (app_settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  business_name TEXT NOT NULL DEFAULT 'بيرفكت | Perfect',
  branch_name TEXT NOT NULL DEFAULT 'أول شارع الهرم، الجيزة',
  tax_registration_no TEXT NOT NULL DEFAULT '412-889-301',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  access_passcode TEXT NOT NULL DEFAULT '12345678',
  address TEXT NOT NULL DEFAULT 'أول شارع الهرم، الجيزة',
  phone TEXT NOT NULL DEFAULT '01000000000',
  receipt_footer_service TEXT NOT NULL DEFAULT 'شكراً لاختياركم مغسلة بيرفكت (Perfect). يرجى فحص السيارة قبل المغادرة.',
  receipt_footer_retail TEXT NOT NULL DEFAULT 'الاستبدال أو الاسترجاع خلال 14 يوماً بأصل الفاتورة والعبوة بحالتها الأصلية.',
  theme TEXT NOT NULL DEFAULT 'royal-blue',
  auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_backup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'royal-blue';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ;

-- ============================================================================
-- 2. جدول الموظفين والأدوار والصلاحيات والعمولات (staff)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('washer', 'detailer', 'cashier', 'inventory_manager', 'supervisor')),
  role_title_ar TEXT NOT NULL,
  phone TEXT NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  permissions JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS permissions JSONB;

-- ============================================================================
-- 3. جدول خدمات الغسيل وتسعير فئات السيارات (wash_services)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wash_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_sedan NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  price_suv NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  price_4x4 NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  price_van NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. جدول المخزن ومنتجات العناية بالسيارات (products)
-- يدعم: قطاعي + نص جملة + جملة + باركود + اسم المخزن
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name_ar TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'عام',
  category TEXT NOT NULL,
  warehouse_name TEXT NOT NULL DEFAULT 'المخزن الرئيسي - الهرم',
  unit TEXT NOT NULL DEFAULT 'عبوة',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  pricing_mode TEXT NOT NULL DEFAULT 'markup_percent' CHECK (pricing_mode IN ('markup_percent', 'markup_fixed', 'manual')),
  markup_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  half_wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER NOT NULL DEFAULT 5,
  supplier_name TEXT NOT NULL DEFAULT '',
  is_for_sale BOOLEAN NOT NULL DEFAULT TRUE,
  is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
  vat_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warehouse_name TEXT NOT NULL DEFAULT 'المخزن الرئيسي - الهرم';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS half_wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- ============================================================================
-- 5. جدول العملاء (customers) والموردين (suppliers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  car_model TEXT NOT NULL DEFAULT '',
  car_plate TEXT NOT NULL DEFAULT '',
  vehicle_tier TEXT NOT NULL DEFAULT 'sedan' CHECK (vehicle_tier IN ('sedan', 'suv', '4x4', 'van')),
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  company_name TEXT,
  address TEXT,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. جدول المحافظ الإلكترونية (wallets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_number TEXT NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. جدول الورديات ومراجعة الدرج (shifts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number TEXT UNIQUE NOT NULL,
  cashier_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  cashier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  wallet_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  card_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  deferred_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_purchases NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_expenses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  customer_cash_collections NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  supplier_cash_payments NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(12,2),
  variance NUMERIC(12,2),
  notes TEXT
);

-- ============================================================================
-- 8. جدول الفواتير المنفصل (invoices) وبنود الفواتير (invoice_items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('service', 'retail')),
  sale_tier TEXT NOT NULL DEFAULT 'retail' CHECK (sale_tier IN ('retail', 'half_wholesale', 'wholesale')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'washing', 'ready', 'completed', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  car_model TEXT,
  car_plate TEXT,
  vehicle_tier TEXT CHECK (vehicle_tier IS NULL OR vehicle_tier IN ('sedan', 'suv', '4x4', 'van')),
  wash_bay TEXT,
  created_by_staff_id UUID NOT NULL REFERENCES public.staff(id),
  performed_by_staff_id UUID REFERENCES public.staff(id),
  completed_by_staff_id UUID REFERENCES public.staff(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_profit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sale_tier TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS wallet_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_performed_staff ON public.invoices(performed_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_staff ON public.invoices(created_by_staff_id);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product')),
  service_id UUID REFERENCES public.wash_services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- ============================================================================
-- 9. جداول المشتريات والمصروفات وسدادات العملاء/الموردين والمرتبات وحركات المخزن
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('utilities', 'rent', 'maintenance', 'supplies', 'hospitality', 'salaries', 'other')),
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.party_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  party_id UUID NOT NULL,
  party_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  month_label TEXT NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  bonuses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('restock', 'sale', 'wash_usage', 'adjustment')),
  quantity_change INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reference_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  performed_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);

-- ============================================================================
-- 10. الدوال والمشغلات (Triggers) وعروض التقارير (Views)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_sync_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock_qty = GREATEST(0, stock_qty + NEW.quantity_change)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_stock_on_movement ON public.stock_movements;
CREATE TRIGGER trg_sync_stock_on_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_stock_on_movement();

CREATE OR REPLACE VIEW public.v_daily_revenue_summary AS
SELECT
  DATE(created_at AT TIME ZONE 'Africa/Cairo') AS business_date,
  COUNT(*) FILTER (WHERE invoice_type = 'service' AND status <> 'cancelled') AS service_invoices_count,
  COALESCE(SUM(total_amount) FILTER (WHERE invoice_type = 'service' AND status <> 'cancelled'), 0) AS service_revenue,
  COUNT(*) FILTER (WHERE invoice_type = 'retail' AND status <> 'cancelled') AS retail_invoices_count,
  COALESCE(SUM(total_amount) FILTER (WHERE invoice_type = 'retail' AND status <> 'cancelled'), 0) AS retail_revenue,
  COALESCE(SUM(vat_amount) FILTER (WHERE status <> 'cancelled'), 0) AS total_vat_collected,
  COALESCE(SUM(net_profit) FILTER (WHERE status <> 'cancelled'), 0) AS total_net_profit
FROM public.invoices
GROUP BY 1
ORDER BY 1 DESC;

-- ============================================================================
-- 11. صلاحيات الوصول وسياسات الأمان (GRANT + RLS) للتشغيل المباشر
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_settings', 'staff', 'wash_services', 'products',
    'customers', 'suppliers', 'wallets', 'shifts',
    'invoices', 'invoice_items', 'purchase_orders', 'purchase_items',
    'expenses', 'party_payments', 'payroll_payouts', 'stock_movements'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_%s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 12. البيانات الأولية الواقعية (Seed Data) — بيرفكت | Perfect
-- ============================================================================
INSERT INTO public.app_settings (
  id, business_name, branch_name, tax_registration_no, vat_rate, access_passcode, address,
  receipt_footer_service, theme, auto_backup_enabled
)
VALUES (
  'default', 'بيرفكت | Perfect', 'أول شارع الهرم، الجيزة', '412-889-301', 14.00, '12345678', 'أول شارع الهرم، الجيزة',
  'شكراً لاختياركم مغسلة بيرفكت (Perfect). يرجى فحص السيارة قبل المغادرة.', 'royal-blue', TRUE
)
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  branch_name = EXCLUDED.branch_name,
  address = EXCLUDED.address;

INSERT INTO public.staff (id, full_name, role, role_title_ar, phone, commission_rate, base_salary, notes) VALUES
  ('11111111-1111-1111-1111-111111111101', 'أحمد مجدي', 'washer', 'فني غسيل وتلميع أول', '01000000001', 10.00, 6500.00, 'مسؤول حارة الغسيل 1 والغسيل الكيماوي'),
  ('11111111-1111-1111-1111-111111111102', 'محمود كمال', 'cashier', 'كاشير ومسؤول مبيعات', '01000000002', 2.00, 7500.00, 'إصدار فواتير الخدمات والمبيعات واستلام النقدية'),
  ('11111111-1111-1111-1111-111111111103', 'كريم عادل', 'washer', 'فني غسيل سيارات', '01000000003', 8.00, 5800.00, 'مسؤول حارة الغسيل 2 والغسيل السريع'),
  ('11111111-1111-1111-1111-111111111104', 'مصطفى حسن', 'detailer', 'أخصائي تلميع ونانو سيراميك', '01000000004', 12.00, 8200.00, 'مسؤول حارة التلميع وحماية الطلاء'),
  ('11111111-1111-1111-1111-111111111105', 'يوسف طارق', 'inventory_manager', 'أمين مخزن ومبيعات منتجات', '01000000005', 3.00, 7000.00, 'إدارة المخزن وتسعير المنتجات وبيع القطع المنفردة'),
  ('11111111-1111-1111-1111-111111111106', 'طارق المنشاوي', 'supervisor', 'مشرف الوردية ومدير التشغيل', '01000000006', 0.00, 11000.00, 'إشراف عام ومراجعة جودة التسليم')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wash_services (id, code, name_ar, category, duration_minutes, price_sedan, price_suv, price_4x4, price_van) VALUES
  ('22222222-2222-2222-2222-222222222201', 'SRV-EXT', 'غسيل خارجي فوم وتجفيف', 'غسيل أساسي', 25, 120.00, 150.00, 175.00, 200.00),
  ('22222222-2222-2222-2222-222222222202', 'SRV-FULL', 'غسيل شامل داخلي وخارجي', 'غسيل شامل', 45, 220.00, 270.00, 310.00, 360.00),
  ('22222222-2222-2222-2222-222222222203', 'SRV-CHEM', 'غسيل كيماوي عميق للفرش والأبواب', 'عناية داخلية', 120, 650.00, 800.00, 900.00, 1050.00),
  ('22222222-2222-2222-2222-222222222204', 'SRV-ENG', 'غسيل محرك بالبخار والعزل الآمن', 'محرك وشاسيه', 35, 180.00, 220.00, 250.00, 280.00),
  ('22222222-2222-2222-2222-222222222205', 'SRV-WAX', 'تلميع شمعي وحماية طلاء', 'تلميع وحماية', 60, 400.00, 500.00, 580.00, 650.00),
  ('22222222-2222-2222-2222-222222222206', 'SRV-NANO', 'طبقة نانو سيراميك سريعة (6 شهور)', 'تلميع وحماية', 90, 950.00, 1200.00, 1400.00, 1600.00),
  ('22222222-2222-2222-2222-222222222207', 'SRV-OZN', 'تعقيم التكييف والصالون بالأوزون', 'عناية داخلية', 30, 160.00, 190.00, 210.00, 240.00),
  ('22222222-2222-2222-2222-222222222208', 'SRV-CHS', 'غسيل شاسيه بضغط عالي ضد الصدأ', 'محرك وشاسيه', 25, 140.00, 180.00, 210.00, 250.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, sku, barcode, name_ar, brand, category, unit, cost_price, pricing_mode, markup_value, selling_price, half_wholesale_price, wholesale_price, stock_qty, min_stock_alert, supplier_name, is_for_sale, is_consumable) VALUES
  ('33333333-3333-3333-3333-333333333301', 'PRD-DRY-500', 'PRD-DRY-500', 'سبراي غسيل جاف سريع 500 مل', 'سونكس - Sonax', 'منظفات خارجية', 'عبوة', 180.00, 'markup_percent', 35.00, 243.00, 223.56, 206.55, 28, 6, 'شركة النيل لتجارة الكيماويات', TRUE, FALSE),
  ('33333333-3333-3333-3333-333333333302', 'PRD-DSH-400', 'PRD-DSH-400', 'ملمع تابلوه مطفي فانيليا 400 مل', 'ميجوايرز - Meguiar''s', 'عناية داخلية', 'عبوة', 210.00, 'markup_fixed', 75.00, 285.00, 262.20, 242.25, 19, 5, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333303', 'PRD-TIR-500', 'PRD-TIR-500', 'جل تلميع وحماية الإطارات 500 مل', 'تيرتل واكس - Turtle Wax', 'عناية الإطارات', 'عبوة', 160.00, 'markup_percent', 40.00, 224.00, 206.08, 190.40, 22, 5, 'شركة النيل لتجارة الكيماويات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333304', 'PRD-FOM-1000', 'PRD-FOM-1000', 'فوم غسيل سيارات مركز 1 لتر', 'مافرا - Mafra', 'شامبو وفوم', 'لتر', 140.00, 'markup_percent', 30.00, 182.00, 167.44, 154.70, 34, 8, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333305', 'PRD-MCF-3PK', 'PRD-MCF-3PK', 'طقم فوط مايكروفايبر 3 قطع (800 GSM)', 'أوتو برو - AutoPro', 'أدوات تجفيف', 'طقم', 110.00, 'markup_fixed', 55.00, 165.00, 151.80, 140.25, 4, 6, 'الفتح للاستيراد والتصدير', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333306', 'PRD-PRF-OUD', 'PRD-PRF-OUD', 'معطر سيارة فاخر (عود وعنبر)', 'أريون - Areon', 'معطرات', 'عبوة', 75.00, 'manual', 120.00, 120.00, 110.40, 102.00, 42, 10, 'الفتح للاستيراد والتصدير', TRUE, FALSE),
  ('33333333-3333-3333-3333-333333333307', 'PRD-SCR-250', 'PRD-SCR-250', 'معجون مزيل خدوش الطلاء 250 جم', '3M - ثري إم', 'تلميع وحماية', 'عبوة', 260.00, 'markup_percent', 35.00, 351.00, 322.92, 298.35, 11, 4, 'توكيل ثري إم مصر', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333308', 'PRD-RIM-500', 'PRD-RIM-500', 'منظف جنوط ومزيل برادة الفرامل 500 مل', 'سونكس - Sonax', 'عناية الإطارات', 'عبوة', 195.00, 'markup_fixed', 65.00, 260.00, 239.20, 221.00, 3, 5, 'شركة النيل لتجارة الكيماويات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333309', 'PRD-WAX-1000', 'PRD-WAX-1000', 'شامبو واكس لغسيل السيارات 1 لتر', 'تيرتل واكس - Turtle Wax', 'شامبو وفوم', 'لتر', 150.00, 'markup_percent', 38.00, 207.00, 190.44, 175.95, 18, 6, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333310', 'PRD-SPG-2X', 'PRD-SPG-2X', 'إسفنجة غسيل ناعمة مزدوجة الوجه', 'أوتو برو - AutoPro', 'أدوات غسيل', 'قطعة', 45.00, 'markup_fixed', 30.00, 75.00, 69.00, 63.75, 26, 8, 'الفتح للاستيراد والتصدير', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, full_name, phone, car_model, car_plate, vehicle_tier, opening_balance) VALUES
  ('44444444-4444-4444-4444-444444444401', 'حسام الدين إبراهيم', '01000000011', 'هيونداي توسان 2024', 'أ ب ج 4821', 'suv', 0),
  ('44444444-4444-4444-4444-444444444402', 'رامي عبد الرحمن', '01000000012', 'مرسيدس C180 2023', 'س ص ط 915', 'sedan', 0),
  ('44444444-4444-4444-4444-444444444403', 'شريف محمد نبيل', '01000000013', 'تويوتا فورتشنر 2022', 'ق م ن 3307', '4x4', 0),
  ('44444444-4444-4444-4444-444444444404', 'أحمد سليم', '01000000014', 'كيا سيراتو 2021', 'د هـ و 7124', 'sedan', 250),
  ('44444444-4444-4444-4444-444444444405', 'وليد فؤاد', '01000000015', 'نيسان قشقاي 2023', 'ع ف غ 604', 'suv', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, name, phone, company_name, address, opening_balance, notes) VALUES
  ('88888888-8888-8888-8888-888888888801', 'شركة النيل لتجارة الكيماويات', '01000000021', 'النيل أوتو كيميكالز', 'المنطقة الصناعية - 6 أكتوبر', 1500, 'مورد سونكس وتيرتل واكس الرئيسي'),
  ('88888888-8888-8888-8888-888888888802', 'المتحدة لمستلزمات السيارات', '01000000022', 'المتحدة جروب', 'التوفيقية - وسط البلد', 0, 'توريد شامبو وفوم وملمعات'),
  ('88888888-8888-8888-8888-888888888803', 'الفتح للاستيراد والتصدير', '01000000023', 'الفتح التجارية', 'فيصل - الجيزة', 0, 'معطرات أريون وفوط مايكروفايبر')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (id, name, provider, account_number, current_balance, is_active) VALUES
  ('99999999-9999-9999-9999-999999999901', 'محفظة فودافون كاش - الفرع', 'Vodafone Cash', '01000000090', 1850, TRUE),
  ('99999999-9999-9999-9999-999999999902', 'حساب إنستاباي - بيرفكت', 'InstaPay', 'perfect@instapay', 2450, TRUE),
  ('99999999-9999-9999-9999-999999999903', 'محفظة اتصالات كاش', 'Etisalat Cash', '01100000091', 420, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shifts (
  id, shift_number, cashier_staff_id, cashier_name, status, opening_cash, cash_sales, wallet_sales, card_sales, expected_cash, actual_cash, variance, notes
) VALUES
  ('aaaa1111-1111-1111-1111-111111111101', 'SHF-2026-0001', '11111111-1111-1111-1111-111111111106', 'طارق المنشاوي', 'closed', 2000, 558.60, 0, 601.92, 1338.60, 1338.60, 0, 'وردية سابقة مطابقة'),
  ('aaaa1111-1111-1111-1111-111111111102', 'SHF-2026-0002', '11111111-1111-1111-1111-111111111102', 'محمود كمال', 'open', 1500, 638.40, 1282.50, 0, 1993.40, NULL, NULL, 'الوردية الحالية')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoices (
  id, invoice_number, invoice_type, sale_tier, status, payment_method, shift_id,
  customer_id, customer_name, customer_phone, car_model, car_plate, vehicle_tier, wash_bay,
  created_by_staff_id, performed_by_staff_id, completed_by_staff_id,
  subtotal, discount_type, discount_value, discount_amount, taxable_amount, vat_rate, vat_amount, total_amount, paid_amount, total_cost, net_profit, notes, created_at, completed_at
) VALUES
  (
    '55555555-5555-5555-5555-555555555501', 'SRV-2026-0001', 'service', 'retail', 'completed', 'cash', 'aaaa1111-1111-1111-1111-111111111101',
    '44444444-4444-4444-4444-444444444401', 'حسام الدين إبراهيم', '01000000011', 'هيونداي توسان 2024', 'أ ب ج 4821', 'suv', 'حارة الغسيل 1',
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102',
    490.00, 'none', 0, 0.00, 490.00, 14.00, 68.60, 558.60, 558.60, 65.00, 425.00, 'أحمد مجدي قام بالغسيل الشامل ومحرك البخار',
    NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555502', 'RTL-2026-0001', 'retail', 'retail', 'completed', 'card', 'aaaa1111-1111-1111-1111-111111111101',
    '44444444-4444-4444-4444-444444444402', 'رامي عبد الرحمن', '01000000012', NULL, NULL, NULL, NULL,
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111102',
    528.00, 'none', 0, 0.00, 528.00, 14.00, 73.92, 601.92, 601.92, 390.00, 138.00, 'بيع منفرد: سبراي غسيل جاف + ملمع تابلوه',
    NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555503', 'SRV-2026-0002', 'service', 'retail', 'washing', 'instapay', 'aaaa1111-1111-1111-1111-111111111102',
    '44444444-4444-4444-4444-444444444403', 'شريف محمد نبيل', '01000000013', 'تويوتا فورتشنر 2022', 'ق م ن 3307', '4x4', 'حارة التلميع 3',
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111104', NULL,
    890.00, 'percent', 10, 89.00, 801.00, 14.00, 112.14, 913.14, 913.14, 140.00, 661.00, 'خصم 10% عميل دائم - قيد التلميع الشمعي',
    NOW() - INTERVAL '45 minutes', NULL
  ),
  (
    '55555555-5555-5555-5555-555555555504', 'SRV-2026-0003', 'service', 'retail', 'ready', 'cash', 'aaaa1111-1111-1111-1111-111111111102',
    '44444444-4444-4444-4444-444444444404', 'أحمد سليم', '01000000014', 'كيا سيراتو 2021', 'د هـ و 7124', 'sedan', 'حارة الغسيل 1',
    '11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111101', NULL,
    220.00, 'none', 0, 0.00, 220.00, 14.00, 30.80, 250.80, 250.80, 30.00, 190.00, 'جاهزة للتسليم بعد غسيل شامل',
    NOW() - INTERVAL '25 minutes', NULL
  ),
  (
    '55555555-5555-5555-5555-555555555505', 'RTL-2026-0002', 'retail', 'retail', 'completed', 'vodafone_cash', 'aaaa1111-1111-1111-1111-111111111102',
    NULL, 'عميل نقدي - بيع سريع', '01000000000', NULL, NULL, NULL, NULL,
    '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111105',
    344.00, 'fixed', 20, 20.00, 324.00, 14.00, 45.36, 369.36, 369.36, 235.00, 89.00, 'شراء جل إطارات + معطر عود',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoice_items (id, invoice_id, item_type, service_id, product_id, item_name, unit_cost, unit_price, quantity, line_discount, line_total) VALUES
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (SUV)', 40.00, 270.00, 1, 0, 270.00),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555501', 'service', '22222222-2222-2222-2222-222222222204', NULL, 'غسيل محرك بالبخار والعزل الآمن (SUV)', 25.00, 220.00, 1, 0, 220.00),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555502', 'product', NULL, '33333333-3333-3333-3333-333333333301', 'سبراي غسيل جاف سريع 500 مل', 180.00, 243.00, 1, 0, 243.00),
  ('66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555502', 'product', NULL, '33333333-3333-3333-3333-333333333302', 'ملمع تابلوه مطفي فانيليا 400 مل', 210.00, 285.00, 1, 0, 285.00),
  ('66666666-6666-6666-6666-666666666605', '55555555-5555-5555-5555-555555555503', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (4x4)', 45.00, 310.00, 1, 0, 310.00),
  ('66666666-6666-6666-6666-666666666606', '55555555-5555-5555-5555-555555555503', 'service', '22222222-2222-2222-2222-222222222205', NULL, 'تلميع شمعي وحماية طلاء (4x4)', 95.00, 580.00, 1, 0, 580.00),
  ('66666666-6666-6666-6666-666666666607', '55555555-5555-5555-5555-555555555504', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (سيدان)', 30.00, 220.00, 1, 0, 220.00),
  ('66666666-6666-6666-6666-666666666608', '55555555-5555-5555-5555-555555555505', 'product', NULL, '33333333-3333-3333-3333-333333333303', 'جل تلميع وحماية الإطارات 500 مل', 160.00, 224.00, 1, 0, 224.00),
  ('66666666-6666-6666-6666-666666666609', '55555555-5555-5555-5555-555555555505', 'product', NULL, '33333333-3333-3333-3333-333333333306', 'معطر سيارة فاخر (عود وعنبر)', 75.00, 120.00, 1, 0, 120.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expenses (id, expense_number, category, title, amount, payment_method, shift_id, staff_id, notes) VALUES
  ('dddd1111-1111-1111-1111-111111111101', 'EXP-2026-0001', 'hospitality', 'ضيافة ومشروبات للعملاء والموظفين', 145, 'cash', 'aaaa1111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111102', 'بوفيه الوردية الصباحية'),
  ('dddd1111-1111-1111-1111-111111111102', 'EXP-2026-0002', 'maintenance', 'صيانة وصلة مسدس ضغط المياه حارة 1', 220, 'cash', 'aaaa1111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111106', 'تغيير جلدة وكابل ضغط عالي')
ON CONFLICT (id) DO NOTHING;
