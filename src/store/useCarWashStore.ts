import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_CUSTOMERS,
  INITIAL_INVOICES,
  INITIAL_PRODUCTS,
  INITIAL_SERVICES,
  INITIAL_SETTINGS,
  INITIAL_STAFF,
  INITIAL_STOCK_MOVEMENTS,
} from '../data/seedData';
import {
  buildSupabaseClient,
  getSavedSupabaseConfig,
} from '../lib/supabaseClient';
import {
  AppSettings,
  Customer,
  DiscountType,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  Product,
  StaffMember,
  StockMovement,
  StockMovementType,
  VehicleTier,
  WashService,
} from '../types/carwash';
import { calculateInvoiceTotals, roundMoney } from '../utils/pricing';

const STORAGE_KEY = 'washcare_carwash_state_v2';

interface PersistedState {
  settings: AppSettings;
  staff: StaffMember[];
  services: WashService[];
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  stockMovements: StockMovement[];
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.staff && parsed.products && parsed.invoices) {
        return {
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          staff: parsed.staff,
          services: parsed.services || INITIAL_SERVICES,
          products: parsed.products,
          customers: parsed.customers || INITIAL_CUSTOMERS,
          invoices: parsed.invoices,
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
    invoices: INITIAL_INVOICES,
    stockMovements: INITIAL_STOCK_MOVEMENTS,
  };
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

export interface CreateInvoicePayload {
  invoice_type: InvoiceType;
  payment_method: PaymentMethod;
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

export function useCarWashStore() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

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
        client.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      const firstError =
        settingsRes.error ||
        staffRes.error ||
        servicesRes.error ||
        productsRes.error ||
        invoicesRes.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

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
      const mappedProducts: Product[] = (productsRes.data || []).map((p: Record<string, unknown>) => {
        const prod: Product = {
          id: String(p.id),
          sku: String(p.sku),
          name_ar: String(p.name_ar),
          brand: String(p.brand || ''),
          category: String(p.category || ''),
          unit: String(p.unit || 'عبوة'),
          cost_price: Number(p.cost_price) || 0,
          pricing_mode: p.pricing_mode as Product['pricing_mode'],
          markup_value: Number(p.markup_value) || 0,
          selling_price: Number(p.selling_price) || 0,
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
      });

      const mappedInvoices: Invoice[] = (invoicesRes.data || []).map((inv: Record<string, unknown>) => ({
        id: String(inv.id),
        invoice_number: String(inv.invoice_number),
        invoice_type: inv.invoice_type as InvoiceType,
        status: inv.status as InvoiceStatus,
        payment_method: inv.payment_method as PaymentMethod,
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
        total_amount: Number(inv.total_amount) || 0,
        total_cost: Number(inv.total_cost) || 0,
        net_profit: Number(inv.net_profit) || 0,
        notes: (inv.notes as string | undefined) || undefined,
        items: itemsByInvoice.get(String(inv.id)) || [],
        created_at: String(inv.created_at),
        completed_at: (inv.completed_at as string | null) ?? null,
      }));

      setState((prev) => ({
        settings: settingsRes.data
          ? {
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
            }
          : prev.settings,
        staff:
          staffRes.data && staffRes.data.length > 0
            ? (staffRes.data as StaffMember[])
            : prev.staff,
        services:
          servicesRes.data && servicesRes.data.length > 0
            ? (servicesRes.data as WashService[])
            : prev.services,
        products: mappedProducts.length > 0 ? mappedProducts : prev.products,
        customers:
          customersRes.data && customersRes.data.length > 0
            ? (customersRes.data as Customer[])
            : prev.customers,
        invoices: mappedInvoices.length > 0 ? mappedInvoices : prev.invoices,
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
    const config = getSavedSupabaseConfig();
    if (config.url && config.anonKey) {
      syncFromSupabase();
    }
  }, [syncFromSupabase]);

  const createInvoice = useCallback(
    async (payload: CreateInvoicePayload): Promise<Invoice> => {
      const invoiceId = generateUuid();
      const now = new Date().toISOString();
      const prefix = payload.invoice_type === 'service' ? 'SRV' : 'RTL';
      const existingOfType = state.invoices.filter(
        (inv) => inv.invoice_type === payload.invoice_type
      ).length;
      const seq = String(existingOfType + 1).padStart(4, '0');
      const invoiceNumber = `${prefix}-2026-${seq}`;

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
      const newInvoice: Invoice = {
        id: invoiceId,
        invoice_number: invoiceNumber,
        invoice_type: payload.invoice_type,
        status: isRetail ? 'completed' : 'washing',
        payment_method: payload.payment_method,
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

        return {
          ...prev,
          products: updatedProducts,
          invoices: [newInvoice, ...prev.invoices],
          stockMovements: [...newMovements, ...prev.stockMovements],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        const { items: _items, ...invoiceRow } = newInvoice;
        await client.from('invoices').insert(invoiceRow);
        await client.from('invoice_items').insert(items);
        if (newMovements.length > 0) {
          await client.from('stock_movements').insert(
            newMovements.map(({ product_name: _pn, ...row }) => row)
          );
        }
      }

      return newInvoice;
    },
    [state.invoices, state.settings.vat_rate]
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
        await client
          .from('invoices')
          .update({
            status,
            ...(status === 'completed'
              ? { completed_at: now, completed_by_staff_id: completedByStaffId }
              : {}),
          })
          .eq('id', invoiceId);
      }
    },
    []
  );

  const upsertProduct = useCallback(async (productData: Omit<Product, 'id' | 'created_at'> & { id?: string }) => {
    const id = productData.id || generateUuid();
    const now = new Date().toISOString();
    const record: Product = {
      ...productData,
      id,
      created_at: now,
    };

    setState((prev) => {
      const exists = prev.products.some((p) => p.id === id);
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === id ? { ...p, ...productData } : p))
          : [record, ...prev.products],
      };
    });

    const client = buildSupabaseClient();
    if (client) {
      await client.from('products').upsert(record);
    }
  }, []);

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
        await client.from('stock_movements').insert(row);
      }
    },
    [state.products]
  );

  const upsertService = useCallback(
    async (serviceData: Omit<WashService, 'id' | 'created_at'> & { id?: string }) => {
      const id = serviceData.id || generateUuid();
      const record: WashService = {
        ...serviceData,
        id,
        created_at: new Date().toISOString(),
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
        await client.from('wash_services').upsert(record);
      }
    },
    []
  );

  const upsertStaff = useCallback(
    async (staffData: Omit<StaffMember, 'id' | 'created_at'> & { id?: string }) => {
      const id = staffData.id || generateUuid();
      const record: StaffMember = {
        ...staffData,
        id,
        created_at: new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.staff.some((s) => s.id === id);
        return {
          ...prev,
          staff: exists
            ? prev.staff.map((s) => (s.id === id ? { ...s, ...staffData } : s))
            : [...prev.staff, record],
        };
      });

      const client = buildSupabaseClient();
      if (client) {
        await client.from('staff').upsert(record);
      }
    },
    []
  );

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setState((prev) => {
      const next = { ...prev.settings, ...patch };
      const client = buildSupabaseClient();
      if (client) {
        client.from('app_settings').upsert(next);
      }
      return { ...prev, settings: next };
    });
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh: PersistedState = {
      settings: INITIAL_SETTINGS,
      staff: INITIAL_STAFF,
      services: INITIAL_SERVICES,
      products: INITIAL_PRODUCTS,
      customers: INITIAL_CUSTOMERS,
      invoices: INITIAL_INVOICES,
      stockMovements: INITIAL_STOCK_MOVEMENTS,
    };
    setState(fresh);
  }, []);

  return {
    ...state,
    supabaseConnected,
    syncing,
    syncError,
    syncFromSupabase,
    createInvoice,
    updateInvoiceStatus,
    upsertProduct,
    adjustProductStock,
    upsertService,
    upsertStaff,
    updateSettings,
    resetDemoData,
  };
}
