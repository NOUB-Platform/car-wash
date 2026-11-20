-- ============================================================================
-- نظام الأهرام كير | Al-Ahram Care
-- قاعدة بيانات إدارة مغسلة السيارات، المخزن، والتسعير، وضريبة 14% (مصر)
-- متوافق بالكامل مع Supabase (PostgreSQL 15+)
-- ============================================================================

-- تفعيل إضافة UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. جدول إعدادات النشاط والضريبة (app_settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  business_name TEXT NOT NULL DEFAULT 'الأهرام كير',
  branch_name TEXT NOT NULL DEFAULT 'أول شارع الهرم، الجيزة',
  tax_registration_no TEXT NOT NULL DEFAULT '412-889-301',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  access_passcode TEXT NOT NULL DEFAULT '12345678',
  address TEXT NOT NULL DEFAULT 'أول شارع الهرم، الجيزة',
  phone TEXT NOT NULL DEFAULT '01000000000',
  receipt_footer_service TEXT NOT NULL DEFAULT 'شكراً لاختياركم الأهرام كير. يرجى فحص السيارة قبل المغادرة.',
  receipt_footer_retail TEXT NOT NULL DEFAULT 'الاستبدال أو الاسترجاع خلال 14 يوماً بأصل الفاتورة والعبوة بحالتها الأصلية.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. جدول الموظفين والأدوار والعمولات (staff)
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
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- يدعم التسعير بنسبة مكسب % أو بهامش ثابت ج.م أو بسعر يدوي
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'عام',
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'عبوة',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  pricing_mode TEXT NOT NULL DEFAULT 'markup_percent' CHECK (pricing_mode IN ('markup_percent', 'markup_fixed', 'manual')),
  markup_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER NOT NULL DEFAULT 5,
  supplier_name TEXT NOT NULL DEFAULT '',
  is_for_sale BOOLEAN NOT NULL DEFAULT TRUE,
  is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
  vat_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. جدول العملاء الدائمين (customers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  car_model TEXT NOT NULL DEFAULT '',
  car_plate TEXT NOT NULL DEFAULT '',
  vehicle_tier TEXT NOT NULL DEFAULT 'sedan' CHECK (vehicle_tier IN ('sedan', 'suv', '4x4', 'van')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. جدول الفواتير المنفصل (service مقابل retail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('service', 'retail')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'washing', 'ready', 'completed', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'vodafone_cash', 'instapay')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  -- حقول خاصة بفواتير خدمات الغسيل فقط
  car_model TEXT,
  car_plate TEXT,
  vehicle_tier TEXT CHECK (vehicle_tier IS NULL OR vehicle_tier IN ('sedan', 'suv', '4x4', 'van')),
  wash_bay TEXT,
  -- ربط المسؤولين (من أصدر الفاتورة، من قام بالغسيل/البيع، من أتم التسليم)
  created_by_staff_id UUID NOT NULL REFERENCES public.staff(id),
  performed_by_staff_id UUID REFERENCES public.staff(id),
  completed_by_staff_id UUID REFERENCES public.staff(id),
  -- الحسابات والخصم وضريبة 14%
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_profit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_performed_staff ON public.invoices(performed_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_staff ON public.invoices(created_by_staff_id);

-- ============================================================================
-- 7. جدول بنود الفواتير (invoice_items)
-- ============================================================================
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
-- 8. جدول حركات المخزن (stock_movements)
-- ============================================================================
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
-- 9. الدوال والمشغلات (Triggers) لتحديث المخزن تلقائياً
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

-- ============================================================================
-- 10. عروض التقارير التحليلية (Views)
-- ============================================================================
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

CREATE OR REPLACE VIEW public.v_staff_performance AS
SELECT
  s.id,
  s.full_name,
  s.role,
  s.role_title_ar,
  s.commission_rate,
  COUNT(DISTINCT inv_perf.id) FILTER (WHERE inv_perf.invoice_type = 'service' AND inv_perf.status <> 'cancelled') AS washes_performed,
  COUNT(DISTINCT inv_cr.id) FILTER (WHERE inv_cr.status <> 'cancelled') AS invoices_issued,
  COALESCE(SUM(inv_perf.taxable_amount) FILTER (WHERE inv_perf.status <> 'cancelled'), 0) AS handled_revenue,
  ROUND(
    COALESCE(SUM(inv_perf.taxable_amount) FILTER (WHERE inv_perf.status <> 'cancelled'), 0) * (s.commission_rate / 100.0),
    2
  ) AS estimated_commission
FROM public.staff s
LEFT JOIN public.invoices inv_perf ON inv_perf.performed_by_staff_id = s.id
LEFT JOIN public.invoices inv_cr ON inv_cr.created_by_staff_id = s.id
GROUP BY s.id, s.full_name, s.role, s.role_title_ar, s.commission_rate;

-- ============================================================================
-- 11. صلاحيات الوصول وسياسات الأمان (GRANT + RLS) للتشغيل المباشر
-- ملاحظة: يمكن تقييد هذه السياسات بـ authenticated عند تفعيل تسجيل الدخول لاحقاً
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wash_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_settings', 'staff', 'wash_services', 'products',
    'customers', 'invoices', 'invoice_items', 'stock_movements'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_%s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 12. البيانات الأولية الواقعية (Seed Data) - جاهزة للتشغيل والتجربة
-- ============================================================================

INSERT INTO public.app_settings (id, business_name, branch_name, tax_registration_no, vat_rate, access_passcode, address)
VALUES ('default', 'الأهرام كير', 'أول شارع الهرم، الجيزة', '412-889-301', 14.00, '12345678', 'أول شارع الهرم، الجيزة')
ON CONFLICT (id) DO NOTHING;

-- طاقم العمل (أحمد مجدي، محمود كمال، وغيرهم)
INSERT INTO public.staff (id, full_name, role, role_title_ar, phone, commission_rate, base_salary, notes) VALUES
  ('11111111-1111-1111-1111-111111111101', 'أحمد مجدي', 'washer', 'فني غسيل وتلميع أول', '01000000001', 10.00, 6500.00, 'مسؤول حارة الغسيل 1 والغسيل الكيماوي'),
  ('11111111-1111-1111-1111-111111111102', 'محمود كمال', 'cashier', 'كاشير ومسؤول مبيعات', '01000000002', 2.00, 7500.00, 'إصدار فواتير الخدمات والمبيعات واستلام النقدية'),
  ('11111111-1111-1111-1111-111111111103', 'كريم عادل', 'washer', 'فني غسيل سيارات', '01000000003', 8.00, 5800.00, 'مسؤول حارة الغسيل 2 والغسيل السريع'),
  ('11111111-1111-1111-1111-111111111104', 'مصطفى حسن', 'detailer', 'أخصائي تلميع ونانو سيراميك', '01000000004', 12.00, 8200.00, 'مسؤول حارة التلميع وحماية الطلاء'),
  ('11111111-1111-1111-1111-111111111105', 'يوسف طارق', 'inventory_manager', 'أمين مخزن ومبيعات منتجات', '01000000005', 3.00, 7000.00, 'إدارة المخزن وتسعير المنتجات وبيع القطع المنفردة'),
  ('11111111-1111-1111-1111-111111111106', 'طارق المنشاوي', 'supervisor', 'مشرف الوردية ومدير التشغيل', '01000000006', 0.00, 11000.00, 'إشراف عام ومراجعة جودة التسليم')
ON CONFLICT (id) DO NOTHING;

-- خدمات الغسيل حسب فئة السيارة (قبل ضريبة 14%)
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

-- مخزن منتجات العناية بالسيارات (متاح للبيع المنفرد مع نظام تسعير التكلفة + المكسب)
INSERT INTO public.products (id, sku, name_ar, brand, category, unit, cost_price, pricing_mode, markup_value, selling_price, stock_qty, min_stock_alert, supplier_name, is_for_sale, is_consumable) VALUES
  ('33333333-3333-3333-3333-333333333301', 'PRD-DRY-500', 'سبراي غسيل جاف سريع 500 مل', 'سونكس - Sonax', 'منظفات خارجية', 'عبوة', 180.00, 'markup_percent', 35.00, 243.00, 28, 6, 'شركة النيل لتجارة الكيماويات', TRUE, FALSE),
  ('33333333-3333-3333-3333-333333333302', 'PRD-DSH-400', 'ملمع تابلوه مطفي فانيليا 400 مل', 'ميجوايرز - Meguiar''s', 'عناية داخلية', 'عبوة', 210.00, 'markup_fixed', 75.00, 285.00, 19, 5, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333303', 'PRD-TIR-500', 'جل تلميع وحماية الإطارات 500 مل', 'تيرتل واكس - Turtle Wax', 'عناية الإطارات', 'عبوة', 160.00, 'markup_percent', 40.00, 224.00, 22, 5, 'شركة النيل لتجارة الكيماويات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333304', 'PRD-FOM-1000', 'فوم غسيل سيارات مركز 1 لتر', 'مافرا - Mafra', 'شامبو وفوم', 'لتر', 140.00, 'markup_percent', 30.00, 182.00, 34, 8, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333305', 'PRD-MCF-3PK', 'طقم فوط مايكروفايبر 3 قطع (800 GSM)', 'أوتو برو - AutoPro', 'أدوات تجفيف', 'طقم', 110.00, 'markup_fixed', 55.00, 165.00, 4, 6, 'الفتح للاستيراد والتصدير', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333306', 'PRD-PRF-OUD', 'معطر سيارة فاخر (عود وعنبر)', 'أريون - Areon', 'معطرات', 'عبوة', 75.00, 'manual', 120.00, 120.00, 42, 10, 'الفتح للاستيراد والتصدير', TRUE, FALSE),
  ('33333333-3333-3333-3333-333333333307', 'PRD-SCR-250', 'معجون مزيل خدوش الطلاء 250 جم', '3M - ثري إم', 'تلميع وحماية', 'عبوة', 260.00, 'markup_percent', 35.00, 351.00, 11, 4, 'توكيل ثري إم مصر', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333308', 'PRD-RIM-500', 'منظف جنوط ومزيل برادة الفرامل 500 مل', 'سونكس - Sonax', 'عناية الإطارات', 'عبوة', 195.00, 'markup_fixed', 65.00, 260.00, 3, 5, 'شركة النيل لتجارة الكيماويات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333309', 'PRD-WAX-1000', 'شامبو واكس لغسيل السيارات 1 لتر', 'تيرتل واكس - Turtle Wax', 'شامبو وفوم', 'لتر', 150.00, 'markup_percent', 38.00, 207.00, 18, 6, 'المتحدة لمستلزمات السيارات', TRUE, TRUE),
  ('33333333-3333-3333-3333-333333333310', 'PRD-SPG-2X', 'إسفنجة غسيل ناعمة مزدوجة الوجه', 'أوتو برو - AutoPro', 'أدوات غسيل', 'قطعة', 45.00, 'markup_fixed', 30.00, 75.00, 26, 8, 'الفتح للاستيراد والتصدير', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- عملاء دائمون
INSERT INTO public.customers (id, full_name, phone, car_model, car_plate, vehicle_tier) VALUES
  ('44444444-4444-4444-4444-444444444401', 'حسام الدين إبراهيم', '01000000011', 'هيونداي توسان 2024', 'أ ب ج 4821', 'suv'),
  ('44444444-4444-4444-4444-444444444402', 'رامي عبد الرحمن', '01000000012', 'مرسيدس C180 2023', 'س ص ط 915', 'sedan'),
  ('44444444-4444-4444-4444-444444444403', 'شريف محمد نبيل', '01000000013', 'تويوتا فورتشنر 2022', 'ق م ن 3307', '4x4'),
  ('44444444-4444-4444-4444-444444444404', 'أحمد سليم', '01000000014', 'كيا سيراتو 2021', 'د هـ و 7124', 'sedan'),
  ('44444444-4444-4444-4444-444444444405', 'وليد فؤاد', '01000000015', 'نيسان قشقاي 2023', 'ع ف غ 604', 'suv')
ON CONFLICT (id) DO NOTHING;

-- فواتير سابقة نموذجية (منفصلة تماماً: فواتير خدمات غسيل SRV وفواتير مبيعات منتجات RTL)
INSERT INTO public.invoices (
  id, invoice_number, invoice_type, status, payment_method,
  customer_id, customer_name, customer_phone, car_model, car_plate, vehicle_tier, wash_bay,
  created_by_staff_id, performed_by_staff_id, completed_by_staff_id,
  subtotal, discount_type, discount_value, discount_amount, taxable_amount, vat_rate, vat_amount, total_amount, total_cost, net_profit, notes, created_at, completed_at
) VALUES
  (
    '55555555-5555-5555-5555-555555555501', 'SRV-2026-0001', 'service', 'completed', 'cash',
    '44444444-4444-4444-4444-444444444401', 'حسام الدين إبراهيم', '01000000011', 'هيونداي توسان 2024', 'أ ب ج 4821', 'suv', 'حارة الغسيل 1',
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102',
    490.00, 'none', 0, 0.00, 490.00, 14.00, 68.60, 558.60, 65.00, 425.00, 'أحمد مجدي قام بالغسيل الشامل ومحرك البخار - تسليم ممتاز',
    NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555502', 'RTL-2026-0001', 'retail', 'completed', 'card',
    '44444444-4444-4444-4444-444444444402', 'رامي عبد الرحمن', '01000000012', NULL, NULL, NULL, NULL,
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111102',
    528.00, 'none', 0, 0.00, 528.00, 14.00, 73.92, 601.92, 390.00, 138.00, 'بيع منفرد: سبراي غسيل جاف + ملمع تابلوه بدون غسيل',
    NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555503', 'SRV-2026-0002', 'service', 'washing', 'instapay',
    '44444444-4444-4444-4444-444444444403', 'شريف محمد نبيل', '01000000013', 'تويوتا فورتشنر 2022', 'ق م ن 3307', '4x4', 'حارة التلميع 3',
    '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111104', NULL,
    890.00, 'percent', 10, 89.00, 801.00, 14.00, 112.14, 913.14, 140.00, 661.00, 'خصم 10% عميل دائم - قيد التلميع الشمعي والغسيل',
    NOW() - INTERVAL '45 minutes', NULL
  ),
  (
    '55555555-5555-5555-5555-555555555504', 'SRV-2026-0003', 'service', 'ready', 'cash',
    '44444444-4444-4444-4444-444444444404', 'أحمد سليم', '01000000014', 'كيا سيراتو 2021', 'د هـ و 7124', 'sedan', 'حارة الغسيل 1',
    '11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111101', NULL,
    220.00, 'none', 0, 0.00, 220.00, 14.00, 30.80, 250.80, 30.00, 190.00, 'جاهزة للتسليم بعد غسيل شامل بواسطة أحمد مجدي',
    NOW() - INTERVAL '25 minutes', NULL
  ),
  (
    '55555555-5555-5555-5555-555555555505', 'RTL-2026-0002', 'retail', 'completed', 'vodafone_cash',
    NULL, 'عميل نقدي - بيع سريع', '01000000000', NULL, NULL, NULL, NULL,
    '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111105',
    344.00, 'fixed', 20, 20.00, 324.00, 14.00, 45.36, 369.36, 235.00, 89.00, 'شراء جل إطارات + معطر عود',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoice_items (invoice_id, item_type, service_id, product_id, item_name, unit_cost, unit_price, quantity, line_discount, line_total) VALUES
  ('55555555-5555-5555-5555-555555555501', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (SUV)', 40.00, 270.00, 1, 0, 270.00),
  ('55555555-5555-5555-5555-555555555501', 'service', '22222222-2222-2222-2222-222222222204', NULL, 'غسيل محرك بالبخار والعزل الآمن (SUV)', 25.00, 220.00, 1, 0, 220.00),
  ('55555555-5555-5555-5555-555555555502', 'product', NULL, '33333333-3333-3333-3333-333333333301', 'سبراي غسيل جاف سريع 500 مل', 180.00, 243.00, 1, 0, 243.00),
  ('55555555-5555-5555-5555-555555555502', 'product', NULL, '33333333-3333-3333-3333-333333333302', 'ملمع تابلوه مطفي فانيليا 400 مل', 210.00, 285.00, 1, 0, 285.00),
  ('55555555-5555-5555-5555-555555555503', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (4x4)', 45.00, 310.00, 1, 0, 310.00),
  ('55555555-5555-5555-5555-555555555503', 'service', '22222222-2222-2222-2222-222222222205', NULL, 'تلميع شمعي وحماية طلاء (4x4)', 95.00, 580.00, 1, 0, 580.00),
  ('55555555-5555-5555-5555-555555555504', 'service', '22222222-2222-2222-2222-222222222202', NULL, 'غسيل شامل داخلي وخارجي (سيدان)', 30.00, 220.00, 1, 0, 220.00),
  ('55555555-5555-5555-5555-555555555505', 'product', NULL, '33333333-3333-3333-3333-333333333303', 'جل تلميع وحماية الإطارات 500 مل', 160.00, 224.00, 1, 0, 224.00),
  ('55555555-5555-5555-5555-555555555505', 'product', NULL, '33333333-3333-3333-3333-333333333306', 'معطر سيارة فاخر (عود وعنبر)', 75.00, 120.00, 1, 0, 120.00);
