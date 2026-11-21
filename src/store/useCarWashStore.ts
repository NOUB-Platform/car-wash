import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_INVOICES,
  INITIAL_PARTY_PAYMENTS,
  INITIAL_PAYROLL,
  INITIAL_PRODUCTS,
  INITIAL_PURCHASES,
  INITIAL_SERVICES,
  INITIAL_SETTINGS,
  INITIAL_SHIFTS,
  INITIAL_STAFF,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_WALLETS,
} from '../data/seedData';
import {
  buildSupabaseClient,
  getSavedSupabaseConfig,
} from '../lib/supabaseClient';
import {
  AppSettings,
  BackupEntry,
  Customer,
  DiscountType,
  Expense,
  ExpenseCategory,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceType,
  PartyPayment,
  PaymentMethod,
  PayrollPayout,
  Product,
  PurchaseItem,
  PurchaseOrder,
  SaleTier,
  ShiftRecord,
  StaffMember,
  StaffPermissions,
  StockMovement,
  StockMovementType,
  Supplier,
  VehicleTier,
  WalletAccount,
  WashService,
} from '../types/carwash';
import {
  calculateInvoiceTotals,
  getDefaultPermissionsForRole,
  isWalletPayment,
  roundMoney,
} from '../utils/pricing';

const STORAGE_KEY = 'washcare_carwash_state_v3';
const BACKUPS_STORAGE_KEY = 'perfect_carwash_backups_v1';
const ACTIVE_STAFF_STORAGE_KEY = 'perfect_active_staff_id_v1';
const AUTO_BACKUP_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

interface PersistedState {
  settings: AppSettings;
  staff: StaffMember[];
  services: WashService[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  wallets: WalletAccount[];
  invoices: Invoice[];
  purchases: PurchaseOrder[];
  expenses: Expense[];
  partyPayments: PartyPayment[];
  shifts: ShiftRecord[];
  payrollPayouts: PayrollPayout[];
  stockMovements: StockMovement[];
}

const LEGACY_BUSINESS_NAMES = new Set([
  'ووش كير للعناية بالسيارات',
  'ووش كير',
  'نقاء أوتو كير',
  'الأهرام كير',
]);
const LEGACY_BRANCH_NAMES = new Set([
  'فرع مدينة نصر - القاهرة',
  'فرع فيصل - الجيزة',
  'فرع فيصل، الجيزة',
]);

function normalizeBrandSettings(raw: AppSettings): AppSettings {
  const businessName = LEGACY_BUSINESS_NAMES.has(raw.business_name?.trim())
    ? INITIAL_SETTINGS.business_name
    : raw.business_name || INITIAL_SETTINGS.business_name;
  const branchName = LEGACY_BRANCH_NAMES.has(raw.branch_name?.trim())
    ? INITIAL_SETTINGS.branch_name
    : raw.branch_name || INITIAL_SETTINGS.branch_name;
  const address =
    !raw.address?.trim() ||
    raw.address.includes('مدينة نصر') ||
    raw.address.includes('فرع أول الهرم')
      ? INITIAL_SETTINGS.address
      : raw.address;
  const footerService =
    raw.receipt_footer_service?.includes('ووش كير') ||
    raw.receipt_footer_service?.includes('الأهرام كير')
      ? INITIAL_SETTINGS.receipt_footer_service
      : raw.receipt_footer_service || INITIAL_SETTINGS.receipt_footer_service;

  return {
    ...raw,
    business_name: businessName,
    branch_name: branchName,
    address,
    receipt_footer_service: footerService,
    theme: raw.theme || INITIAL_SETTINGS.theme,
    auto_backup_enabled: raw.auto_backup_enabled ?? true,
    last_backup_at: raw.last_backup_at ?? INITIAL_SETTINGS.last_backup_at,
  };
}

function hydrateStaffPermissions(list: StaffMember[]): StaffMember[] {
  return list.map((m) => ({
    ...m,
    permissions: m.permissions
      ? { ...getDefaultPermissionsForRole(m.role), ...m.permissions }
      : getDefaultPermissionsForRole(m.role),
  }));
}

function hydrateProducts(list: Product[]): Product[] {
  return list.map((p) => ({
    ...p,
    barcode: p.barcode || p.sku,
    warehouse_name: p.warehouse_name || 'المخزن الرئيسي - الهرم',
    half_wholesale_price:
      p.half_wholesale_price && p.half_wholesale_price > 0
        ? p.half_wholesale_price
        : roundMoney(Math.max(p.cost_price + 2, p.selling_price * 0.92)),
    wholesale_price:
      p.wholesale_price && p.wholesale_price > 0
        ? p.wholesale_price
        : roundMoney(Math.max(p.cost_price + 1, p.selling_price * 0.85)),
  }));
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.staff && parsed.products && parsed.invoices) {
        return {
          settings: normalizeBrandSettings({ ...INITIAL_SETTINGS, ...(parsed.settings || {}) }),
          staff: hydrateStaffPermissions(parsed.staff),
          services: parsed.services || INITIAL_SERVICES,
          products: hydrateProducts(parsed.products),
          customers: parsed.customers || INITIAL_CUSTOMERS,
          suppliers: parsed.suppliers || INITIAL_SUPPLIERS,
          wallets: parsed.wallets || INITIAL_WALLETS,
          invoices: parsed.invoices,
          purchases: parsed.purchases || INITIAL_PURCHASES,
          expenses: parsed.expenses || INITIAL_EXPENSES,
          partyPayments: parsed.partyPayments || INITIAL_PARTY_PAYMENTS,
          shifts: parsed.shifts || INITIAL_SHIFTS,
          payrollPayouts: parsed.payrollPayouts || INITIAL_PAYROLL,
          stockMovements: parsed.stockMovements || INITIAL_STOCK_MOVEMENTS,
        };
      }
    }
  } catch {
    // Fallback to initial seed data
  }
  return {
    settings: INITIAL_SETTINGS,
    staff: INITIAL_STAFF,
    services: INITIAL_SERVICES,
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    wallets: INITIAL_WALLETS,
    invoices: INITIAL_INVOICES,
    purchases: INITIAL_PURCHASES,
    expenses: INITIAL_EXPENSES,
    partyPayments: INITIAL_PARTY_PAYMENTS,
    shifts: INITIAL_SHIFTS,
    payrollPayouts: INITIAL_PAYROLL,
    stockMovements: INITIAL_STOCK_MOVEMENTS,
  };
}

function loadBackups(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isOptionalSchemaMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function resolveWalletIdFromPayment(
  paymentMethod: PaymentMethod,
  wallets: WalletAccount[],
  explicitWalletId?: string | null
): string | null {
  if (explicitWalletId) return explicitWalletId;
  if (paymentMethod.startsWith('wallet:')) {
    return paymentMethod.slice('wallet:'.length);
  }
  if (paymentMethod === 'vodafone_cash') {
    return (
      wallets.find((w) => w.provider.toLowerCase().includes('vodafone'))?.id ?? null
    );
  }
  if (paymentMethod === 'instapay') {
    return (
      wallets.find((w) => w.provider.toLowerCase().includes('instapay'))?.id ?? null
    );
  }
  return null;
}

export interface CreateInvoicePayload {
  invoice_type: InvoiceType;
  sale_tier?: SaleTier;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  customer_id?: string | null;
  save_customer?: boolean;
  customer_name: string;
  customer_phone: string;
  car_model?: string;
  car_plate?: string;
  vehicle_tier?: VehicleTier;
  wash_bay?: string;
  created_by_staff_id: string;
  performed_by_staff_id: string;
  discount_type: DiscountType;
  discount_value: number;
  notes?: string;
  items: Array<{
    item_type: 'service' | 'product';
    service_id?: string | null;
    product_id?: string | null;
    item_name: string;
    unit_cost: number;
    unit_price: number;
    quantity: number;
    line_discount?: number;
  }>;
}

export interface CreatePurchasePayload {
  supplier_id?: string | null;
  supplier_name: string;
  payment_method: PaymentMethod;
  wallet_id?: string | null;
  created_by_staff_id: string;
  vat_amount?: number;
  paid_amount?: number;
  notes?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
  }>;
}

export function useCarWashStore() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [backups, setBackups] = useState<BackupEntry[]>(loadBackups);
  const [activeStaffId, setActiveStaffIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_STAFF_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // Ignore
    }
    return INITIAL_STAFF[5]?.id || INITIAL_STAFF[1]?.id || INITIAL_STAFF[0].id;
  });

  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const activeStaff = useMemo(
    () =>
      state.staff.find((s) => s.id === activeStaffId && s.is_active) ||
      state.staff.find((s) => s.role === 'supervisor' && s.is_active) ||
      state.staff[0],
    [state.staff, activeStaffId]
  );

  const effectivePermissions: StaffPermissions = useMemo(() => {
    if (!activeStaff) return getDefaultPermissionsForRole('supervisor');
    return (
      activeStaff.permissions || getDefaultPermissionsForRole(activeStaff.role)
    );
  }, [activeStaff]);

  const setActiveStaffId = useCallback((id: string) => {
    setActiveStaffIdState(id);
    try {
      localStorage.setItem(ACTIVE_STAFF_STORAGE_KEY, id);
    } catch {
      // Ignore
    }
  }, []);

  const currentOpenShift = useMemo(
    () => state.shifts.find((s) => s.status === 'open') || null,
    [state.shifts]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups.slice(0, 10)));
    } catch {
      // Ignore quota errors
    }
  }, [backups]);

  const createBackup = useCallback(
    (kind: 'auto' | 'manual' = 'manual'): BackupEntry => {
      const now = new Date().toISOString();
      const payload = JSON.stringify({
        exported_at: now,
        app: 'بيرفكت | Perfect',
        version: '4.0',
        data: state,
      });
      const sizeKb = Math.max(1, Math.round(payload.length / 1024));
      const entry: BackupEntry = {
        id: generateUuid(),
        created_at: now,
        kind,
        size_kb: sizeKb,
        summary: `${state.invoices.length} فاتورة · ${state.products.length} منتج · ${state.purchases.length} مشتريات`,
        payload_json: payload,
      };
      setBackups((prev) => [entry, ...prev].slice(0, 10));
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, last_backup_at: now },
      }));
      return entry;
    },
    [state]
  );

  const restoreBackup = useCallback((rawJson: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(rawJson);
      const data = (parsed?.data || parsed) as Partial<PersistedState>;
      if (!data.staff || !data.products || !data.invoices) {
        return { ok: false, message: 'ملف النسخة الاحتياطية غير صالح أو ناقص.' };
      }
      setState({
        settings: normalizeBrandSettings({ ...INITIAL_SETTINGS, ...(data.settings || {}) }),
        staff: hydrateStaffPermissions(data.staff),
        services: data.services || INITIAL_SERVICES,
        products: hydrateProducts(data.products),
        customers: data.customers || INITIAL_CUSTOMERS,
        suppliers: data.suppliers || INITIAL_SUPPLIERS,
        wallets: data.wallets || INITIAL_WALLETS,
        invoices: data.invoices,
        purchases: data.purchases || INITIAL_PURCHASES,
        expenses: data.expenses || INITIAL_EXPENSES,
        partyPayments: data.partyPayments || INITIAL_PARTY_PAYMENTS,
        shifts: data.shifts || INITIAL_SHIFTS,
        payrollPayouts: data.payrollPayouts || INITIAL_PAYROLL,
        stockMovements: data.stockMovements || INITIAL_STOCK_MOVEMENTS,
      });
      return { ok: true, message: 'تمت استعادة النسخة الاحتياطية بنجاح.' };
    } catch {
      return { ok: false, message: 'تعذر قراءة ملف النسخة الاحتياطية (JSON غير صحيح).' };
    }
  }, []);

  // Automatic backup scheduler every 3 hours
  useEffect(() => {
    if (state.settings.auto_backup_enabled === false) return;

    const checkAndRunBackup = () => {
      const lastIso = state.settings.last_backup_at;
      const lastTime = lastIso ? new Date(lastIso).getTime() : 0;
      if (!lastTime || Date.now() - lastTime >= AUTO_BACKUP_INTERVAL_MS) {
        createBackup('auto');
      }
    };

    const initialTimer = setTimeout(checkAndRunBackup, 4000);
    const interval = setInterval(checkAndRunBackup, 5 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [state.settings.auto_backup_enabled, state.settings.last_backup_at, createBackup]);

  const syncFromSupabase = useCallback(async () => {
    const config = getSavedSupabaseConfig();
    if (!config.url || !config.anonKey) {
      setSupabaseConnected(false);
      return false;
    }

    const client = buildSupabaseClient(config);
    if (!client) {
      setSupabaseConnected(false);
      return false;
    }

    setSyncing(true);
    setSyncError(null);
    try {
      const [
        settingsRes,
        staffRes,
        servicesRes,
        productsRes,
        customersRes,
        invoicesRes,
        itemsRes,
        movementsRes,
      ] = await Promise.all([
        client.from('app_settings').select('*').eq('id', 'default').maybeSingle(),
        client.from('staff').select('*').order('created_at', { ascending: true }),
        client.from('wash_services').select('*').order('code', { ascending: true }),
        client.from('products').select('*').order('sku', { ascending: true }),
        client.from('customers').select('*').order('created_at', { ascending: false }),
        client.from('invoices').select('*').order('created_at', { ascending: false }),
        client.from('invoice_items').select('*'),
        client.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(150),
      ]);

      const firstError =
        settingsRes.error ||
        staffRes.error ||
        servicesRes.error ||
        productsRes.error ||
        customersRes.error ||
        invoicesRes.error ||
        itemsRes.error ||
        movementsRes.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

      // Extended tables (gracefully ignored if user hasn't run updated schema.sql yet)
      const [
        suppliersRes,
        walletsRes,
        purchasesRes,
        purchaseItemsRes,
        expensesRes,
        partyPaymentsRes,
        shiftsRes,
        payrollRes,
      ] = await Promise.all([
        client.from('suppliers').select('*').order('created_at', { ascending: false }),
        client.from('wallets').select('*').order('created_at', { ascending: true }),
        client.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        client.from('purchase_items').select('*'),
        client.from('expenses').select('*').order('created_at', { ascending: false }),
        client.from('party_payments').select('*').order('created_at', { ascending: false }),
        client.from('shifts').select('*').order('opened_at', { ascending: false }),
        client.from('payroll_payouts').select('*').order('created_at', { ascending: false }),
      ]);

      const itemsByInvoice = new Map<string, InvoiceItem[]>();
      (itemsRes.data || []).forEach((it: Record<string, unknown>) => {
        const invId = String(it.invoice_id);
        const list = itemsByInvoice.get(invId) || [];
        list.push({
          id: String(it.id),
          invoice_id: invId,
          item_type: it.item_type as 'service' | 'product',
          service_id: (it.service_id as string | null) ?? null,
          product_id: (it.product_id as string | null) ?? null,
          item_name: String(it.item_name),
          unit_cost: Number(it.unit_cost) || 0,
          unit_price: Number(it.unit_price) || 0,
          quantity: Number(it.quantity) || 1,
          line_discount: Number(it.line_discount) || 0,
          line_total: Number(it.line_total) || 0,
        });
        itemsByInvoice.set(invId, list);
      });

      const productNameMap = new Map<string, string>();
      const mappedProducts: Product[] = hydrateProducts(
        (productsRes.data || []).map((p: Record<string, unknown>) => {
          const prod: Product = {
            id: String(p.id),
            sku: String(p.sku),
            barcode: (p.barcode as string | undefined) || String(p.sku),
            name_ar: String(p.name_ar),
            brand: String(p.brand || ''),
            category: String(p.category || ''),
            warehouse_name: (p.warehouse_name as string | undefined) || 'المخزن الرئيسي - الهرم',
            unit: String(p.unit || 'عبوة'),
            cost_price: Number(p.cost_price) || 0,
            pricing_mode: p.pricing_mode as Product['pricing_mode'],
            markup_value: Number(p.markup_value) || 0,
            selling_price: Number(p.selling_price) || 0,
            half_wholesale_price: Number(p.half_wholesale_price) || 0,
            wholesale_price: Number(p.wholesale_price) || 0,
            stock_qty: Number(p.stock_qty) || 0,
            min_stock_alert: Number(p.min_stock_alert) || 5,
            supplier_name: String(p.supplier_name || ''),
            is_for_sale: Boolean(p.is_for_sale),
            is_consumable: Boolean(p.is_consumable),
            vat_applicable: Boolean(p.vat_applicable),
            created_at: String(p.created_at),
          };
          productNameMap.set(prod.id, prod.name_ar);
          return prod;
        })
      );

      const mappedInvoices: Invoice[] = (invoicesRes.data || []).map((inv: Record<string, unknown>) => {
        const totalAmt = Number(inv.total_amount) || 0;
        const pm = inv.payment_method as PaymentMethod;
        return {
          id: String(inv.id),
          invoice_number: String(inv.invoice_number),
          invoice_type: inv.invoice_type as InvoiceType,
          sale_tier: (inv.sale_tier as SaleTier | undefined) || 'retail',
          status: inv.status as InvoiceStatus,
          payment_method: pm,
          wallet_id: (inv.wallet_id as string | null) ?? null,
          shift_id: (inv.shift_id as string | null) ?? null,
          customer_id: (inv.customer_id as string | null) ?? null,
          customer_name: String(inv.customer_name),
          customer_phone: String(inv.customer_phone || ''),
          car_model: (inv.car_model as string | null) ?? null,
          car_plate: (inv.car_plate as string | null) ?? null,
          vehicle_tier: (inv.vehicle_tier as VehicleTier | null) ?? null,
          wash_bay: (inv.wash_bay as string | null) ?? null,
          created_by_staff_id: String(inv.created_by_staff_id),
          performed_by_staff_id: (inv.performed_by_staff_id as string | null) ?? null,
          completed_by_staff_id: (inv.completed_by_staff_id as string | null) ?? null,
          subtotal: Number(inv.subtotal) || 0,
          discount_type: inv.discount_type as DiscountType,
          discount_value: Number(inv.discount_value) || 0,
          discount_amount: Number(inv.discount_amount) || 0,
          taxable_amount: Number(inv.taxable_amount) || 0,
          vat_rate: Number(inv.vat_rate) || 14,
          vat_amount: Number(inv.vat_amount) || 0,
          total_amount: totalAmt,
          paid_amount:
            inv.paid_amount !== undefined && inv.paid_amount !== null
              ? Number(inv.paid_amount)
              : pm === 'deferred'
              ? 0
              : totalAmt,
          total_cost: Number(inv.total_cost) || 0,
          net_profit: Number(inv.net_profit) || 0,
          notes: (inv.notes as string | undefined) || undefined,
          items: itemsByInvoice.get(String(inv.id)) || [],
          created_at: String(inv.created_at),
          completed_at: (inv.completed_at as string | null) ?? null,
        };
      });

      const purchaseItemsMap = new Map<string, PurchaseItem[]>();
      if (!purchaseItemsRes.error && purchaseItemsRes.data) {
        purchaseItemsRes.data.forEach((pi: Record<string, unknown>) => {
          const pId = String(pi.purchase_id);
          const list = purchaseItemsMap.get(pId) || [];
          list.push({
            id: String(pi.id),
            purchase_id: pId,
            product_id: String(pi.product_id || ''),
            product_name: String(pi.product_name),
            quantity: Number(pi.quantity) || 1,
            unit_cost: Number(pi.unit_cost) || 0,
            line_total: Number(pi.line_total) || 0,
          });
          purchaseItemsMap.set(pId, list);
        });
      }

      const dbInitialized = Boolean(
        settingsRes.data ||
          (staffRes.data && staffRes.data.length > 0) ||
          (customersRes.data && customersRes.data.length > 0) ||
          mappedProducts.length > 0
      );

      setState((prev) => ({
        settings: settingsRes.data
          ? normalizeBrandSettings({
              ...prev.settings,
              id: String(settingsRes.data.id),
              business_name: String(settingsRes.data.business_name),
              branch_name: String(settingsRes.data.branch_name),
              tax_registration_no: String(settingsRes.data.tax_registration_no),
              vat_rate: Number(settingsRes.data.vat_rate) || 14,
              access_passcode: String(settingsRes.data.access_passcode || '12345678'),
              address: String(settingsRes.data.address || ''),
              phone: String(settingsRes.data.phone || ''),
              receipt_footer_service: String(settingsRes.data.receipt_footer_service || ''),
              receipt_footer_retail: String(settingsRes.data.receipt_footer_retail || ''),
              theme: (settingsRes.data.theme as AppSettings['theme']) || prev.settings.theme,
            })
          : prev.settings,
        staff:
          staffRes.data && staffRes.data.length > 0
            ? hydrateStaffPermissions(staffRes.data as StaffMember[])
            : prev.staff,
        services:
          servicesRes.data && servicesRes.data.length > 0
            ? (servicesRes.data as WashService[])
            : prev.services,
        products:
          mappedProducts.length > 0
            ? mappedProducts
            : dbInitialized
            ? []
            : prev.products,
        customers:
          customersRes.data && (dbInitialized || customersRes.data.length > 0)
            ? (customersRes.data as Customer[])
            : prev.customers,
        suppliers:
          !suppliersRes.error && suppliersRes.data && suppliersRes.data.length > 0
            ? (suppliersRes.data as Supplier[])
            : prev.suppliers,
        wallets:
          !walletsRes.error && walletsRes.data && walletsRes.data.length > 0
            ? (walletsRes.data as WalletAccount[])
            : prev.wallets,
        invoices:
          mappedInvoices.length > 0 || dbInitialized
            ? mappedInvoices
            : prev.invoices,
        purchases:
          !purchasesRes.error && purchasesRes.data && purchasesRes.data.length > 0
            ? (purchasesRes.data as Record<string, unknown>[]).map((po) => ({
                id: String(po.id),
                purchase_number: String(po.purchase_number),
                supplier_id: (po.supplier_id as string | null) ?? null,
                supplier_name: String(po.supplier_name),
                payment_method: po.payment_method as PaymentMethod,
                wallet_id: (po.wallet_id as string | null) ?? null,
                shift_id: (po.shift_id as string | null) ?? null,
                created_by_staff_id: String(po.created_by_staff_id || ''),
                subtotal: Number(po.subtotal) || 0,
                vat_amount: Number(po.vat_amount) || 0,
                total_amount: Number(po.total_amount) || 0,
                paid_amount: Number(po.paid_amount) || 0,
                notes: (po.notes as string | undefined) || undefined,
                items: purchaseItemsMap.get(String(po.id)) || [],
                created_at: String(po.created_at),
              }))
            : prev.purchases,
        expenses:
          !expensesRes.error && expensesRes.data && expensesRes.data.length > 0
            ? (expensesRes.data as Expense[])
            : prev.expenses,
        partyPayments:
          !partyPaymentsRes.error && partyPaymentsRes.data && partyPaymentsRes.data.length > 0
            ? (partyPaymentsRes.data as PartyPayment[])
            : prev.partyPayments,
        shifts:
          !shiftsRes.error && shiftsRes.data && shiftsRes.data.length > 0
            ? (shiftsRes.data as ShiftRecord[])
            : prev.shifts,
        payrollPayouts:
          !payrollRes.error && payrollRes.data && payrollRes.data.length > 0
            ? (payrollRes.data as PayrollPayout[])
            : prev.payrollPayouts,
        stockMovements: (movementsRes.data || []).map((m: Record<string, unknown>) => ({
          id: String(m.id),
          product_id: String(m.product_id),
          product_name: productNameMap.get(String(m.product_id)) || 'منتج',
          movement_type: m.movement_type as StockMovementType,
          quantity_change: Number(m.quantity_change) || 0,
          unit_cost: Number(m.unit_cost) || 0,
          reference_invoice_id: (m.reference_invoice_id as string | null) ?? null,
          performed_by_staff_id: (m.performed_by_staff_id as string | null) ?? null,
          notes: (m.notes as string | undefined) || undefined,
          created_at: String(m.created_at),
        })),
      }));

      setSupabaseConnected(true);
      return true;
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'تعذر المزامنة مع Supabase');
      setSupabaseConnected(false);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let lastSyncAt = 0;
    const runSyncIfConfigured = () => {
      const config = getSavedSupabaseConfig();
      if (!config.url || !config.anonKey) return;
      const now = Date.now();
      if (now - lastSyncAt < 4000) return;
      lastSyncAt = now;
      syncFromSupabase();
    };

    runSyncIfConfigured();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runSyncIfConfigured();
      }
    };
    window.addEventListener('focus', runSyncIfConfigured);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', runSyncIfConfigured);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncFromSupabase]);

  const createInvoice = useCallback(
    async (payload: CreateInvoicePayload): Promise<Invoice> => {
      const invoiceId = generateUuid();
      const now = new Date().toISOString();
      const prefix = payload.invoice_type === 'service' ? 'SRV' : 'RTL';
      const existingNums = state.invoices
        .filter((inv) => inv.invoice_type === payload.invoice_type)
        .map((inv) => {
          const tail = inv.invoice_number.split('-').pop();
          return Number(tail) || 0;
        });
      const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
      const seq = String(nextNum).padStart(4, '0');
      const invoiceNumber = `${prefix}-2026-${seq}`;

      let resolvedCustomerId: string | null = payload.customer_id ?? null;
      let newCustomerRecord: Customer | null = null;
      if (
        !resolvedCustomerId &&
        payload.save_customer &&
        payload.customer_name.trim()
      ) {
        resolvedCustomerId = generateUuid();
        newCustomerRecord = {
          id: resolvedCustomerId,
          full_name: payload.customer_name.trim(),
          phone: payload.customer_phone.trim(),
          car_model: payload.car_model?.trim() || '',
          car_plate: payload.car_plate?.trim() || '',
          vehicle_tier: payload.vehicle_tier || 'sedan',
          opening_balance: 0,
          created_at: now,
        };
      }

      const totals = calculateInvoiceTotals({
        items: payload.items,
        discountType: payload.discount_type,
        discountValue: payload.discount_value,
        vatRate: state.settings.vat_rate,
      });

      const items: InvoiceItem[] = payload.items.map((item) => ({
        id: generateUuid(),
        invoice_id: invoiceId,
        item_type: item.item_type,
        service_id: item.service_id ?? null,
        product_id: item.product_id ?? null,
        item_name: item.item_name,
        unit_cost: roundMoney(item.unit_cost),
        unit_price: roundMoney(item.unit_price),
        quantity: item.quantity,
        line_discount: roundMoney(item.line_discount || 0),
        line_total: roundMoney(item.unit_price * item.quantity - (item.line_discount || 0)),
      }));

      const isRetail = payload.invoice_type === 'retail';
      const isDeferred = payload.payment_method === 'deferred';
      const resolvedWalletId = resolveWalletIdFromPayment(
        payload.payment_method,
        state.wallets,
        payload.wallet_id
      );
      const openShiftId = currentOpenShift?.id ?? null;

      const newInvoice: Invoice = {
        id: invoiceId,
        invoice_number: invoiceNumber,
        invoice_type: payload.invoice_type,
        sale_tier: payload.sale_tier || 'retail',
        status: isRetail ? 'completed' : 'washing',
        payment_method: payload.payment_method,
        wallet_id: resolvedWalletId,
        shift_id: openShiftId,
        customer_id: resolvedCustomerId,
        customer_name: payload.customer_name.trim() || 'عميل نقدي',
        customer_phone: payload.customer_phone.trim(),
        car_model: isRetail ? null : payload.car_model?.trim() || null,
        car_plate: isRetail ? null : payload.car_plate?.trim() || null,
        vehicle_tier: isRetail ? null : payload.vehicle_tier || 'sedan',
        wash_bay: isRetail ? null : payload.wash_bay || 'حارة الغسيل 1',
        created_by_staff_id: payload.created_by_staff_id,
        performed_by_staff_id: payload.performed_by_staff_id,
        completed_by_staff_id: isRetail ? payload.created_by_staff_id : null,
        subtotal: totals.subtotal,
        discount_type: payload.discount_type,
        discount_value: payload.discount_value,
        discount_amount: totals.discountAmount,
        taxable_amount: totals.taxableAmount,
        vat_rate: state.settings.vat_rate,
        vat_amount: totals.vatAmount,
        total_amount: totals.totalAmount,
        paid_amount: isDeferred ? 0 : totals.totalAmount,
        total_cost: totals.totalCost,
        net_profit: totals.netProfit,
        notes: payload.notes,
        items,
        created_at: now,
        completed_at: isRetail ? now : null,
      };

      const newMovements: StockMovement[] = [];
      if (isRetail) {
        items.forEach((item) => {
          if (item.product_id) {
            newMovements.push({
              id: generateUuid(),
              product_id: item.product_id,
              product_name: item.item_name,
              movement_type: 'sale',
              quantity_change: -item.quantity,
              unit_cost: item.unit_cost,
              reference_invoice_id: invoiceId,
              performed_by_staff_id: payload.performed_by_staff_id,
              notes: `فاتورة بيع منفرد ${invoiceNumber}`,
              created_at: now,
            });
          }
        });
      }

      setState((prev) => {
        const updatedProducts = prev.products.map((prod) => {
          const soldQty = items
            .filter((it) => it.product_id === prod.id)
            .reduce((sum, it) => sum + it.quantity, 0);
          if (soldQty > 0 && isRetail) {
            return { ...prod, stock_qty: Math.max(0, prod.stock_qty - soldQty) };
          }
          return prod;
        });

        const updatedWallets = resolvedWalletId
          ? prev.wallets.map((w) =>
              w.id === resolvedWalletId
                ? { ...w, current_balance: roundMoney(w.current_balance + totals.totalAmount) }
                : w
            )
          : prev.wallets;

        const updatedShifts = openShiftId
          ? prev.shifts.map((sh) => {
              if (sh.id !== openShiftId) return sh;
              const addCash = payload.payment_method === 'cash' ? totals.totalAmount : 0;
              const addWallet = isWalletPayment(payload.payment_method) ? totals.totalAmount : 0;
              const addCard = payload.payment_method === 'card' ? totals.totalAmount : 0;
              const addDef = isDeferred ? totals.totalAmount : 0;
              return {
                ...sh,
                cash_sales: roundMoney(sh.cash_sales + addCash),
                wallet_sales: roundMoney(sh.wallet_sales + addWallet),
                card_sales: roundMoney(sh.card_sales + addCard),
                deferred_sales: roundMoney(sh.deferred_sales + addDef),
                expected_cash: roundMoney(sh.expected_cash + addCash),
              };
            })
          : prev.shifts;

        return {
          ...prev,
          products: updatedProducts,
          wallets: updatedWallets,
          shifts: updatedShifts,
          customers: newCustomerRecord
            ? [newCustomerRecord, ...prev.customers]
            : prev.customers,
          invoices: [newInvoice, ...prev.invoices],
          stockMovements: [...newMovements, ...prev.stockMovements],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        setSyncError(null);
        if (newCustomerRecord) {
          const custRes = await client.from('customers').insert(newCustomerRecord);
          if (custRes.error && isOptionalSchemaMissing(custRes.error)) {
            const { opening_balance: _ob, ...legacyCust } = newCustomerRecord;
            await client.from('customers').insert(legacyCust);
          }
        }
        const { items: _items, ...invoiceRow } = newInvoice;
        const invRes = await client.from('invoices').insert(invoiceRow);
        if (invRes.error && isOptionalSchemaMissing(invRes.error)) {
          const {
            sale_tier: _st,
            wallet_id: _wi,
            shift_id: _si,
            paid_amount: _pa,
            ...legacyInv
          } = invoiceRow;
          const retryRes = await client.from('invoices').insert({
            ...legacyInv,
            payment_method:
              legacyInv.payment_method === 'deferred' ||
              legacyInv.payment_method.startsWith('wallet:')
                ? 'vodafone_cash'
                : legacyInv.payment_method,
          });
          if (retryRes.error) setSyncError(retryRes.error.message);
        } else if (invRes.error) {
          setSyncError(invRes.error.message);
        }

        const itemsRes = await client.from('invoice_items').insert(items);
        if (itemsRes.error) setSyncError(itemsRes.error.message);
        if (newMovements.length > 0) {
          const movRes = await client.from('stock_movements').insert(
            newMovements.map(({ product_name: _pn, ...row }) => row)
          );
          if (movRes.error) setSyncError(movRes.error.message);
        }
      }

      return newInvoice;
    },
    [state.invoices, state.settings.vat_rate, state.wallets, currentOpenShift]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: InvoiceStatus, completedByStaffId?: string) => {
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          return {
            ...inv,
            status,
            completed_by_staff_id:
              status === 'completed'
                ? completedByStaffId || inv.created_by_staff_id
                : inv.completed_by_staff_id,
            completed_at: status === 'completed' ? now : inv.completed_at,
          };
        }),
      }));

      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client
          .from('invoices')
          .update({
            status,
            ...(status === 'completed'
              ? { completed_at: now, completed_by_staff_id: completedByStaffId ?? null }
              : {}),
          })
          .eq('id', invoiceId);
        if (error) setSyncError(error.message);
      }
    },
    []
  );

  const upsertProduct = useCallback(
    async (productData: Omit<Product, 'id' | 'created_at'> & { id?: string }) => {
      const id = productData.id || generateUuid();
      const now = new Date().toISOString();
      const existing = state.products.find((p) => p.id === id);
      const record: Product = {
        ...productData,
        barcode: productData.barcode || productData.sku,
        warehouse_name: productData.warehouse_name || 'المخزن الرئيسي - الهرم',
        half_wholesale_price:
          productData.half_wholesale_price ||
          roundMoney(Math.max(productData.cost_price, productData.selling_price * 0.92)),
        wholesale_price:
          productData.wholesale_price ||
          roundMoney(Math.max(productData.cost_price, productData.selling_price * 0.85)),
        id,
        created_at: existing?.created_at || now,
      };

      setState((prev) => {
        const exists = prev.products.some((p) => p.id === id);
        return {
          ...prev,
          products: exists
            ? prev.products.map((p) => (p.id === id ? { ...p, ...record } : p))
            : [record, ...prev.products],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client.from('products').upsert(record);
        if (error && isOptionalSchemaMissing(error)) {
          const {
            barcode: _bc,
            warehouse_name: _wh,
            half_wholesale_price: _hw,
            wholesale_price: _ws,
            ...legacyRecord
          } = record;
          const retry = await client.from('products').upsert(legacyRecord);
          if (retry.error) setSyncError(retry.error.message);
        } else if (error) {
          setSyncError(error.message);
        }
      }
    },
    [state.products]
  );

  const adjustProductStock = useCallback(
    async (params: {
      product_id: string;
      movement_type: StockMovementType;
      quantity_change: number;
      performed_by_staff_id: string;
      notes: string;
    }) => {
      const prod = state.products.find((p) => p.id === params.product_id);
      if (!prod) return;
      const now = new Date().toISOString();
      const movement: StockMovement = {
        id: generateUuid(),
        product_id: params.product_id,
        product_name: prod.name_ar,
        movement_type: params.movement_type,
        quantity_change: params.quantity_change,
        unit_cost: prod.cost_price,
        performed_by_staff_id: params.performed_by_staff_id,
        notes: params.notes,
        created_at: now,
      };

      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === params.product_id
            ? { ...p, stock_qty: Math.max(0, p.stock_qty + params.quantity_change) }
            : p
        ),
        stockMovements: [movement, ...prev.stockMovements],
      }));

      const client = buildSupabaseClient();
      if (client) {
        const { product_name: _pn, ...row } = movement;
        const { error } = await client.from('stock_movements').insert(row);
        if (error) setSyncError(error.message);
      }
    },
    [state.products]
  );

  const upsertService = useCallback(
    async (serviceData: Omit<WashService, 'id' | 'created_at'> & { id?: string }) => {
      const id = serviceData.id || generateUuid();
      const existing = state.services.find((s) => s.id === id);
      const record: WashService = {
        ...serviceData,
        id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.services.some((s) => s.id === id);
        return {
          ...prev,
          services: exists
            ? prev.services.map((s) => (s.id === id ? { ...s, ...serviceData } : s))
            : [...prev.services, record],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client.from('wash_services').upsert(record);
        if (error) setSyncError(error.message);
      }
    },
    [state.services]
  );

  const upsertStaff = useCallback(
    async (staffData: Omit<StaffMember, 'id' | 'created_at'> & { id?: string }) => {
      const id = staffData.id || generateUuid();
      const existing = state.staff.find((s) => s.id === id);
      const record: StaffMember = {
        ...staffData,
        permissions:
          staffData.permissions || getDefaultPermissionsForRole(staffData.role),
        id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.staff.some((s) => s.id === id);
        return {
          ...prev,
          staff: exists
            ? prev.staff.map((s) => (s.id === id ? { ...s, ...record } : s))
            : [...prev.staff, record],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client.from('staff').upsert(record);
        if (error && isOptionalSchemaMissing(error)) {
          const { permissions: _perm, ...legacyStaff } = record;
          const retry = await client.from('staff').upsert(legacyStaff);
          if (retry.error) setSyncError(retry.error.message);
        } else if (error) {
          setSyncError(error.message);
        }
      }
    },
    [state.staff]
  );

  const upsertCustomer = useCallback(
    async (custData: Omit<Customer, 'id' | 'created_at'> & { id?: string }) => {
      const id = custData.id || generateUuid();
      const existing = state.customers.find((c) => c.id === id);
      const record: Customer = {
        ...custData,
        opening_balance: Number(custData.opening_balance) || 0,
        id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.customers.some((c) => c.id === id);
        return {
          ...prev,
          customers: exists
            ? prev.customers.map((c) => (c.id === id ? { ...c, ...record } : c))
            : [record, ...prev.customers],
        };
      });
      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client.from('customers').upsert(record);
        if (error && isOptionalSchemaMissing(error)) {
          const { opening_balance: _ob, ...legacyCust } = record;
          await client.from('customers').upsert(legacyCust);
        }
      }
    },
    [state.customers]
  );

  const upsertSupplier = useCallback(
    async (supData: Omit<Supplier, 'id' | 'created_at'> & { id?: string }) => {
      const id = supData.id || generateUuid();
      const existing = state.suppliers.find((s) => s.id === id);
      const record: Supplier = {
        ...supData,
        opening_balance: Number(supData.opening_balance) || 0,
        id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.suppliers.some((s) => s.id === id);
        return {
          ...prev,
          suppliers: exists
            ? prev.suppliers.map((s) => (s.id === id ? { ...s, ...record } : s))
            : [record, ...prev.suppliers],
        };
      });
      const client = buildSupabaseClient();
      if (client) {
        await client.from('suppliers').upsert(record);
      }
    },
    [state.suppliers]
  );

  const upsertWallet = useCallback(
    async (walletData: Omit<WalletAccount, 'id' | 'created_at'> & { id?: string }) => {
      const id = walletData.id || generateUuid();
      const existing = state.wallets.find((w) => w.id === id);
      const record: WalletAccount = {
        ...walletData,
        id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.wallets.some((w) => w.id === id);
        return {
          ...prev,
          wallets: exists
            ? prev.wallets.map((w) => (w.id === id ? { ...w, ...record } : w))
            : [...prev.wallets, record],
        };
      });
      const client = buildSupabaseClient();
      if (client) {
        await client.from('wallets').upsert(record);
      }
    },
    [state.wallets]
  );

  const deleteWallet = useCallback(async (walletId: string) => {
    setState((prev) => ({
      ...prev,
      wallets: prev.wallets.filter((w) => w.id !== walletId),
    }));
    const client = buildSupabaseClient();
    if (client) {
      await client.from('wallets').delete().eq('id', walletId);
    }
  }, []);

  const createPurchaseOrder = useCallback(
    async (payload: CreatePurchasePayload): Promise<PurchaseOrder> => {
      const purchaseId = generateUuid();
      const now = new Date().toISOString();
      const existingNums = state.purchases.map((p) => {
        const tail = p.purchase_number.split('-').pop();
        return Number(tail) || 0;
      });
      const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
      const purchaseNumber = `PUR-2026-${String(nextNum).padStart(4, '0')}`;

      const items: PurchaseItem[] = payload.items.map((it) => ({
        id: generateUuid(),
        purchase_id: purchaseId,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_cost: roundMoney(it.unit_cost),
        line_total: roundMoney(it.quantity * it.unit_cost),
      }));

      const subtotal = roundMoney(items.reduce((s, it) => s + it.line_total, 0));
      const vatAmount = roundMoney(payload.vat_amount || 0);
      const totalAmount = roundMoney(subtotal + vatAmount);
      const isDeferred = payload.payment_method === 'deferred';
      const paidAmount = isDeferred
        ? roundMoney(payload.paid_amount || 0)
        : roundMoney(payload.paid_amount ?? totalAmount);

      const resolvedWalletId = resolveWalletIdFromPayment(
        payload.payment_method,
        state.wallets,
        payload.wallet_id
      );
      const openShiftId = currentOpenShift?.id ?? null;

      const newOrder: PurchaseOrder = {
        id: purchaseId,
        purchase_number: purchaseNumber,
        supplier_id: payload.supplier_id ?? null,
        supplier_name: payload.supplier_name,
        payment_method: payload.payment_method,
        wallet_id: resolvedWalletId,
        shift_id: openShiftId,
        created_by_staff_id: payload.created_by_staff_id,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        notes: payload.notes,
        items,
        created_at: now,
      };

      const newMovements: StockMovement[] = items.map((it) => ({
        id: generateUuid(),
        product_id: it.product_id,
        product_name: it.product_name,
        movement_type: 'restock',
        quantity_change: it.quantity,
        unit_cost: it.unit_cost,
        performed_by_staff_id: payload.created_by_staff_id,
        notes: `فاتورة مشتريات ${purchaseNumber} - ${payload.supplier_name}`,
        created_at: now,
      }));

      setState((prev) => {
        const updatedProducts = prev.products.map((prod) => {
          const purchasedItem = items.find((it) => it.product_id === prod.id);
          if (!purchasedItem) return prod;
          return {
            ...prod,
            stock_qty: prod.stock_qty + purchasedItem.quantity,
            cost_price: purchasedItem.unit_cost > 0 ? purchasedItem.unit_cost : prod.cost_price,
          };
        });

        const updatedWallets =
          resolvedWalletId && paidAmount > 0
            ? prev.wallets.map((w) =>
                w.id === resolvedWalletId
                  ? { ...w, current_balance: roundMoney(Math.max(0, w.current_balance - paidAmount)) }
                  : w
              )
            : prev.wallets;

        const updatedShifts =
          openShiftId && payload.payment_method === 'cash' && paidAmount > 0
            ? prev.shifts.map((sh) =>
                sh.id === openShiftId
                  ? {
                      ...sh,
                      cash_purchases: roundMoney(sh.cash_purchases + paidAmount),
                      expected_cash: roundMoney(sh.expected_cash - paidAmount),
                    }
                  : sh
              )
            : prev.shifts;

        return {
          ...prev,
          products: updatedProducts,
          wallets: updatedWallets,
          shifts: updatedShifts,
          purchases: [newOrder, ...prev.purchases],
          stockMovements: [...newMovements, ...prev.stockMovements],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        const { items: _it, ...orderRow } = newOrder;
        await client.from('purchase_orders').insert(orderRow);
        await client.from('purchase_items').insert(items);
        await client
          .from('stock_movements')
          .insert(newMovements.map(({ product_name: _pn, ...row }) => row));
      }

      return newOrder;
    },
    [state.purchases, state.wallets, currentOpenShift]
  );

  const addExpense = useCallback(
    async (params: {
      category: ExpenseCategory;
      title: string;
      amount: number;
      payment_method: PaymentMethod;
      wallet_id?: string | null;
      staff_id: string;
      notes?: string;
    }) => {
      const now = new Date().toISOString();
      const existingNums = state.expenses.map((e) => Number(e.expense_number.split('-').pop()) || 0);
      const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
      const expenseNumber = `EXP-2026-${String(nextNum).padStart(4, '0')}`;
      const resolvedWalletId = resolveWalletIdFromPayment(
        params.payment_method,
        state.wallets,
        params.wallet_id
      );
      const openShiftId = currentOpenShift?.id ?? null;
      const amount = roundMoney(Math.max(0, params.amount));

      const record: Expense = {
        id: generateUuid(),
        expense_number: expenseNumber,
        category: params.category,
        title: params.title.trim(),
        amount,
        payment_method: params.payment_method,
        wallet_id: resolvedWalletId,
        shift_id: openShiftId,
        staff_id: params.staff_id,
        notes: params.notes,
        created_at: now,
      };

      setState((prev) => {
        const updatedWallets = resolvedWalletId
          ? prev.wallets.map((w) =>
              w.id === resolvedWalletId
                ? { ...w, current_balance: roundMoney(Math.max(0, w.current_balance - amount)) }
                : w
            )
          : prev.wallets;

        const updatedShifts =
          openShiftId && params.payment_method === 'cash'
            ? prev.shifts.map((sh) =>
                sh.id === openShiftId
                  ? {
                      ...sh,
                      cash_expenses: roundMoney(sh.cash_expenses + amount),
                      expected_cash: roundMoney(sh.expected_cash - amount),
                    }
                  : sh
              )
            : prev.shifts;

        return {
          ...prev,
          wallets: updatedWallets,
          shifts: updatedShifts,
          expenses: [record, ...prev.expenses],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        await client.from('expenses').insert(record);
      }
    },
    [state.expenses, state.wallets, currentOpenShift]
  );

  const deleteExpense = useCallback(async (expenseId: string) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));
    const client = buildSupabaseClient();
    if (client) {
      await client.from('expenses').delete().eq('id', expenseId);
    }
  }, []);

  const recordPartyPayment = useCallback(
    async (params: {
      party_type: 'customer' | 'supplier';
      party_id: string;
      party_name: string;
      amount: number;
      payment_method: PaymentMethod;
      wallet_id?: string | null;
      staff_id: string;
      notes?: string;
    }) => {
      const now = new Date().toISOString();
      const amount = roundMoney(Math.max(0, params.amount));
      const resolvedWalletId = resolveWalletIdFromPayment(
        params.payment_method,
        state.wallets,
        params.wallet_id
      );
      const openShiftId = currentOpenShift?.id ?? null;

      const payment: PartyPayment = {
        id: generateUuid(),
        party_type: params.party_type,
        party_id: params.party_id,
        party_name: params.party_name,
        amount,
        payment_method: params.payment_method,
        wallet_id: resolvedWalletId,
        shift_id: openShiftId,
        staff_id: params.staff_id,
        notes: params.notes,
        created_at: now,
      };

      setState((prev) => {
        const deltaWallet = params.party_type === 'customer' ? amount : -amount;
        const updatedWallets = resolvedWalletId
          ? prev.wallets.map((w) =>
              w.id === resolvedWalletId
                ? { ...w, current_balance: roundMoney(Math.max(0, w.current_balance + deltaWallet)) }
                : w
            )
          : prev.wallets;

        const updatedShifts =
          openShiftId && params.payment_method === 'cash'
            ? prev.shifts.map((sh) => {
                if (sh.id !== openShiftId) return sh;
                if (params.party_type === 'customer') {
                  return {
                    ...sh,
                    customer_cash_collections: roundMoney(sh.customer_cash_collections + amount),
                    expected_cash: roundMoney(sh.expected_cash + amount),
                  };
                }
                return {
                  ...sh,
                  supplier_cash_payments: roundMoney(sh.supplier_cash_payments + amount),
                  expected_cash: roundMoney(sh.expected_cash - amount),
                };
              })
            : prev.shifts;

        return {
          ...prev,
          wallets: updatedWallets,
          shifts: updatedShifts,
          partyPayments: [payment, ...prev.partyPayments],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        await client.from('party_payments').insert(payment);
      }
    },
    [state.wallets, currentOpenShift]
  );

  const openShift = useCallback(
    async (params: { cashier_staff_id: string; cashier_name: string; opening_cash: number; notes?: string }) => {
      const now = new Date().toISOString();
      const existingNums = state.shifts.map((s) => Number(s.shift_number.split('-').pop()) || 0);
      const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
      const opening = roundMoney(Math.max(0, params.opening_cash));

      const newShift: ShiftRecord = {
        id: generateUuid(),
        shift_number: `SHF-2026-${String(nextNum).padStart(4, '0')}`,
        cashier_staff_id: params.cashier_staff_id,
        cashier_name: params.cashier_name,
        status: 'open',
        opened_at: now,
        opening_cash: opening,
        cash_sales: 0,
        wallet_sales: 0,
        card_sales: 0,
        deferred_sales: 0,
        cash_purchases: 0,
        cash_expenses: 0,
        customer_cash_collections: 0,
        supplier_cash_payments: 0,
        expected_cash: opening,
        notes: params.notes,
      };

      setState((prev) => ({
        ...prev,
        shifts: [newShift, ...prev.shifts],
      }));

      const client = buildSupabaseClient();
      if (client) {
        await client.from('shifts').insert(newShift);
      }
      return newShift;
    },
    [state.shifts]
  );

  const closeShift = useCallback(
    async (params: { shift_id: string; actual_cash: number; notes?: string }) => {
      const now = new Date().toISOString();
      const actualCash = roundMoney(Math.max(0, params.actual_cash));
      let closedRecord: ShiftRecord | null = null;

      setState((prev) => ({
        ...prev,
        shifts: prev.shifts.map((sh) => {
          if (sh.id !== params.shift_id) return sh;
          const variance = roundMoney(actualCash - sh.expected_cash);
          closedRecord = {
            ...sh,
            status: 'closed',
            closed_at: now,
            actual_cash: actualCash,
            variance,
            notes: params.notes ?? sh.notes,
          };
          return closedRecord;
        }),
      }));

      const client = buildSupabaseClient();
      if (client && closedRecord) {
        const rec = closedRecord as ShiftRecord;
        await client
          .from('shifts')
          .update({
            status: 'closed',
            closed_at: now,
            actual_cash: rec.actual_cash,
            variance: rec.variance,
            notes: rec.notes,
          })
          .eq('id', params.shift_id);
      }
    },
    []
  );

  const recordPayrollPayout = useCallback(
    async (params: Omit<PayrollPayout, 'id' | 'created_at'>) => {
      const now = new Date().toISOString();
      const payout: PayrollPayout = {
        ...params,
        id: generateUuid(),
        created_at: now,
      };
      const openShiftId = currentOpenShift?.id ?? null;

      setState((prev) => ({
        ...prev,
        shifts:
          openShiftId && params.payment_method === 'cash'
            ? prev.shifts.map((sh) =>
                sh.id === openShiftId
                  ? {
                      ...sh,
                      cash_expenses: roundMoney(sh.cash_expenses + params.net_paid),
                      expected_cash: roundMoney(sh.expected_cash - params.net_paid),
                    }
                  : sh
              )
            : prev.shifts,
        payrollPayouts: [payout, ...prev.payrollPayouts],
      }));

      const client = buildSupabaseClient();
      if (client) {
        await client.from('payroll_payouts').insert(payout);
      }
    },
    [currentOpenShift]
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next: AppSettings = { ...state.settings, ...patch };
      setState((prev) => ({ ...prev, settings: next }));

      const client = buildSupabaseClient();
      if (client) {
        const { error } = await client.from('app_settings').upsert(next);
        if (error && isOptionalSchemaMissing(error)) {
          const {
            theme: _th,
            auto_backup_enabled: _ab,
            last_backup_at: _lb,
            ...legacySettings
          } = next;
          const retry = await client.from('app_settings').upsert(legacySettings);
          if (retry.error) setSyncError(retry.error.message);
        } else if (error) {
          setSyncError(error.message);
        }
      }
    },
    [state.settings]
  );

  const pushLocalDataToSupabase = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const client = buildSupabaseClient();
    if (!client) {
      return {
        ok: false,
        message: 'يرجى حفظ بيانات الاتصال بـ Supabase أولاً.',
      };
    }

    setSyncing(true);
    setSyncError(null);
    try {
      const settingsRes = await client.from('app_settings').upsert(state.settings);
      if (settingsRes.error && isOptionalSchemaMissing(settingsRes.error)) {
        const {
          theme: _th,
          auto_backup_enabled: _ab,
          last_backup_at: _lb,
          ...legacySettings
        } = state.settings;
        const retry = await client.from('app_settings').upsert(legacySettings);
        if (retry.error) throw new Error(retry.error.message);
      } else if (settingsRes.error) {
        throw new Error(settingsRes.error.message);
      }

      if (state.staff.length > 0) {
        const staffRes = await client.from('staff').upsert(state.staff);
        if (staffRes.error && isOptionalSchemaMissing(staffRes.error)) {
          const retry = await client
            .from('staff')
            .upsert(state.staff.map(({ permissions: _p, ...rest }) => rest));
          if (retry.error) throw new Error(retry.error.message);
        } else if (staffRes.error) {
          throw new Error(staffRes.error.message);
        }
      }

      if (state.services.length > 0) {
        const svcRes = await client.from('wash_services').upsert(state.services);
        if (svcRes.error) throw new Error(svcRes.error.message);
      }

      if (state.products.length > 0) {
        const prodRes = await client.from('products').upsert(state.products);
        if (prodRes.error && isOptionalSchemaMissing(prodRes.error)) {
          const retry = await client.from('products').upsert(
            state.products.map(
              ({
                barcode: _b,
                warehouse_name: _w,
                half_wholesale_price: _hw,
                wholesale_price: _ws,
                ...rest
              }) => rest
            )
          );
          if (retry.error) throw new Error(retry.error.message);
        } else if (prodRes.error) {
          throw new Error(prodRes.error.message);
        }
      }

      if (state.customers.length > 0) {
        const custRes = await client.from('customers').upsert(state.customers);
        if (custRes.error && isOptionalSchemaMissing(custRes.error)) {
          await client
            .from('customers')
            .upsert(state.customers.map(({ opening_balance: _ob, ...rest }) => rest));
        } else if (custRes.error) {
          throw new Error(custRes.error.message);
        }
      }

      // Extended tables push silently if created in Supabase
      if (state.suppliers.length > 0) await client.from('suppliers').upsert(state.suppliers);
      if (state.wallets.length > 0) await client.from('wallets').upsert(state.wallets);
      if (state.shifts.length > 0) await client.from('shifts').upsert(state.shifts);
      if (state.expenses.length > 0) await client.from('expenses').upsert(state.expenses);
      if (state.partyPayments.length > 0)
        await client.from('party_payments').upsert(state.partyPayments);
      if (state.payrollPayouts.length > 0)
        await client.from('payroll_payouts').upsert(state.payrollPayouts);

      await syncFromSupabase();
      return {
        ok: true,
        message: 'تم رفع البيانات إلى Supabase بنجاح.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر رفع البيانات إلى Supabase';
      setSyncError(msg);
      return { ok: false, message: msg };
    } finally {
      setSyncing(false);
    }
  }, [state, syncFromSupabase]);

  const resetDemoData = useCallback(() => {
    const fresh: PersistedState = {
      settings: INITIAL_SETTINGS,
      staff: INITIAL_STAFF,
      services: INITIAL_SERVICES,
      products: INITIAL_PRODUCTS,
      customers: INITIAL_CUSTOMERS,
      suppliers: INITIAL_SUPPLIERS,
      wallets: INITIAL_WALLETS,
      invoices: INITIAL_INVOICES,
      purchases: INITIAL_PURCHASES,
      expenses: INITIAL_EXPENSES,
      partyPayments: INITIAL_PARTY_PAYMENTS,
      shifts: INITIAL_SHIFTS,
      payrollPayouts: INITIAL_PAYROLL,
      stockMovements: INITIAL_STOCK_MOVEMENTS,
    };
    setState(fresh);
  }, []);

  return {
    ...state,
    backups,
    activeStaff,
    activeStaffId,
    setActiveStaffId,
    effectivePermissions,
    currentOpenShift,
    supabaseConnected,
    syncing,
    syncError,
    syncFromSupabase,
    pushLocalDataToSupabase,
    createInvoice,
    updateInvoiceStatus,
    upsertProduct,
    adjustProductStock,
    upsertService,
    upsertStaff,
    upsertCustomer,
    upsertSupplier,
    upsertWallet,
    deleteWallet,
    createPurchaseOrder,
    addExpense,
    deleteExpense,
    recordPartyPayment,
    openShift,
    closeShift,
    recordPayrollPayout,
    createBackup,
    restoreBackup,
    updateSettings,
    resetDemoData,
  };
}
