import React, { useMemo, useState } from 'react';
import {
  CarFront,
  Check,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  Customer,
  DiscountType,
  Invoice,
  InvoiceType,
  PaymentMethod,
  Product,
  SaleTier,
  StaffMember,
  VehicleTier,
  WalletAccount,
  WashService,
} from '../types/carwash';
import { playSoundEffect } from '../utils/feedback';
import {
  calculateInvoiceTotals,
  calculatePriceWithVat,
  formatEGP,
  getProductPriceForSaleTier,
  getServicePriceForTier,
  SALE_TIER_LABELS,
  VEHICLE_TIER_LABELS,
  WASH_BAYS,
} from '../utils/pricing';
import { CreateInvoicePayload } from '../store/useCarWashStore';

interface PosViewProps {
  initialMode: InvoiceType;
  services: WashService[];
  products: Product[];
  staff: StaffMember[];
  customers: Customer[];
  wallets: WalletAccount[];
  vatRate: number;
  defaultCashierId?: string;
  canApplyDiscount: boolean;
  canSellWholesale: boolean;
  onCreateInvoice: (payload: CreateInvoicePayload) => Promise<Invoice>;
  onInvoiceCreated: (invoice: Invoice) => void;
}

interface CartEntry {
  key: string;
  item_type: 'service' | 'product';
  service_id?: string;
  product_id?: string;
  item_name: string;
  unit_cost: number;
  unit_price: number;
  quantity: number;
  max_stock?: number;
}

export const PosView: React.FC<PosViewProps> = ({
  initialMode,
  services,
  products,
  staff,
  customers,
  wallets,
  vatRate,
  defaultCashierId,
  canApplyDiscount,
  canSellWholesale,
  onCreateInvoice,
  onInvoiceCreated,
}) => {
  const [mode, setMode] = useState<InvoiceType>(initialMode);
  const [saleTier, setSaleTier] = useState<SaleTier>('retail');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  // Separate carts so service & retail items NEVER mix
  const [serviceCart, setServiceCart] = useState<CartEntry[]>([]);
  const [retailCart, setRetailCart] = useState<CartEntry[]>([]);

  // Service-specific fields
  const [vehicleTier, setVehicleTier] = useState<VehicleTier>('sedan');
  const [carModel, setCarModel] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [washBay, setWashBay] = useState(WASH_BAYS[0]);

  // Shared invoice fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [saveCustomer, setSaveCustomer] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const washers = useMemo(
    () => staff.filter((s) => s.is_active && (s.role === 'washer' || s.role === 'detailer')),
    [staff]
  );
  const sellers = useMemo(
    () =>
      staff.filter(
        (s) =>
          s.is_active &&
          (s.role === 'inventory_manager' || s.role === 'cashier' || s.role === 'supervisor')
      ),
    [staff]
  );
  const cashiers = useMemo(
    () =>
      staff.filter(
        (s) =>
          s.is_active &&
          (s.role === 'cashier' || s.role === 'supervisor' || s.role === 'inventory_manager')
      ),
    [staff]
  );

  const [performedByWasherId, setPerformedByWasherId] = useState<string>(
    washers[0]?.id || staff[0]?.id || ''
  );
  const [performedBySellerId, setPerformedBySellerId] = useState<string>(
    sellers[0]?.id || staff[0]?.id || ''
  );
  const [createdByCashierId, setCreatedByCashierId] = useState<string>(
    defaultCashierId || cashiers[0]?.id || staff[1]?.id || staff[0]?.id || ''
  );

  const paymentOptions = useMemo(() => {
    const list: Array<{ value: PaymentMethod; label: string }> = [
      { value: 'cash', label: 'نقدي (كاش)' },
      { value: 'card', label: 'بطاقة بنكية (فيزا)' },
    ];
    wallets
      .filter((w) => w.is_active)
      .forEach((w) => {
        list.push({
          value: `wallet:${w.id}`,
          label: `${w.name} (${w.provider})`,
        });
      });
    list.push({ value: 'deferred', label: 'آجل (على الحساب)' });
    return list;
  }, [wallets]);

  const activeCart = mode === 'service' ? serviceCart : retailCart;
  const setActiveCart = mode === 'service' ? setServiceCart : setRetailCart;

  const categories = useMemo(() => {
    const list =
      mode === 'service'
        ? services.filter((s) => s.is_active).map((s) => s.category)
        : products.filter((p) => p.is_for_sale).map((p) => p.category);
    return ['الكل', ...Array.from(new Set(list))];
  }, [mode, services, products]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (!s.is_active) return false;
      if (selectedCategory !== 'الكل' && s.category !== selectedCategory) return false;
      if (
        searchTerm &&
        !s.name_ar.includes(searchTerm) &&
        !s.code.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [services, selectedCategory, searchTerm]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_for_sale) return false;
      if (selectedCategory !== 'الكل' && p.category !== selectedCategory) return false;
      if (
        searchTerm &&
        !p.name_ar.includes(searchTerm) &&
        !p.sku.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.brand.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [products, selectedCategory, searchTerm]);

  const handleModeSwitch = (nextMode: InvoiceType) => {
    playSoundEffect('click');
    setMode(nextMode);
    setSelectedCategory('الكل');
    setSearchTerm('');
    setFormError(null);
  };

  const handleTierChange = (nextTier: VehicleTier) => {
    playSoundEffect('click');
    setVehicleTier(nextTier);
    setServiceCart((prev) =>
      prev.map((entry) => {
        const svc = services.find((s) => s.id === entry.service_id);
        if (!svc) return entry;
        const nextPrice = getServicePriceForTier(svc, nextTier);
        return {
          ...entry,
          item_name: `${svc.name_ar} (${VEHICLE_TIER_LABELS[nextTier].split(' ')[0]})`,
          unit_price: nextPrice,
        };
      })
    );
  };

  const handleSaleTierChange = (nextTier: SaleTier) => {
    if (nextTier !== 'retail' && !canSellWholesale) {
      playSoundEffect('error');
      setFormError('ليس لديك صلاحية البيع بسعر الجملة أو نص الجملة.');
      return;
    }
    playSoundEffect('click');
    setFormError(null);
    setSaleTier(nextTier);
    setRetailCart((prev) =>
      prev.map((entry) => {
        const prod = products.find((p) => p.id === entry.product_id);
        if (!prod) return entry;
        return {
          ...entry,
          unit_price: getProductPriceForSaleTier(prod, nextTier),
        };
      })
    );
  };

  // Multi-select checkbox toggle for wash services
  const toggleServiceSelection = (svc: WashService) => {
    playSoundEffect('click');
    setFormError(null);
    const price = getServicePriceForTier(svc, vehicleTier);
    const tierShort = VEHICLE_TIER_LABELS[vehicleTier].split(' ')[0];
    setServiceCart((prev) => {
      const exists = prev.some((i) => i.service_id === svc.id);
      if (exists) {
        return prev.filter((i) => i.service_id !== svc.id);
      }
      return [
        ...prev,
        {
          key: svc.id,
          item_type: 'service',
          service_id: svc.id,
          item_name: `${svc.name_ar} (${tierShort})`,
          unit_cost: Math.round(price * 0.15),
          unit_price: price,
          quantity: 1,
        },
      ];
    });
  };

  // Multi-select checkbox toggle for retail products
  const toggleProductSelection = (prod: Product) => {
    setFormError(null);
    if (prod.stock_qty <= 0) {
      playSoundEffect('error');
      setFormError(`المنتج "${prod.name_ar}" غير متوفر بالمخزن حالياً.`);
      return;
    }
    playSoundEffect('click');
    const unitPrice = getProductPriceForSaleTier(prod, saleTier);
    setRetailCart((prev) => {
      const exists = prev.some((i) => i.product_id === prod.id);
      if (exists) {
        return prev.filter((i) => i.product_id !== prod.id);
      }
      return [
        ...prev,
        {
          key: prod.id,
          item_type: 'product',
          product_id: prod.id,
          item_name: prod.name_ar,
          unit_cost: prod.cost_price,
          unit_price: unitPrice,
          quantity: 1,
          max_stock: prod.stock_qty,
        },
      ];
    });
  };

  const updateCartQty = (key: string, delta: number) => {
    setFormError(null);
    setActiveCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const nextQty = item.quantity + delta;
          if (item.max_stock !== undefined && nextQty > item.max_stock) {
            setFormError(`الحد الأقصى المتاح بالمخزن هو ${item.max_stock}.`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setCustomerName(cust.full_name);
    setCustomerPhone(cust.phone);
    setSaveCustomer(false);
    if (mode === 'service') {
      setCarModel(cust.car_model);
      setCarPlate(cust.car_plate);
      handleTierChange(cust.vehicle_tier);
    }
  };

  const totals = useMemo(
    () =>
      calculateInvoiceTotals({
        items: activeCart,
        discountType,
        discountValue,
        vatRate,
      }),
    [activeCart, discountType, discountValue, vatRate]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (activeCart.length === 0) {
      setFormError(
        mode === 'service'
          ? 'حدد خدمة غسيل واحدة على الأقل لإصدار الفاتورة.'
          : 'حدد منتجاً واحداً على الأقل لإصدار فاتورة البيع.'
      );
      return;
    }

    if (mode === 'service' && !carPlate.trim() && !carModel.trim()) {
      setFormError('يرجى إدخال موديل السيارة أو رقم اللوحة لفاتورة الغسيل.');
      return;
    }

    if (paymentMethod === 'deferred' && !selectedCustomerId && !customerName.trim()) {
      setFormError('للدفع الآجل (على الحساب)، يرجى اختيار عميل مسجل أو إدخال اسم العميل.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await onCreateInvoice({
        invoice_type: mode,
        sale_tier: mode === 'retail' ? saleTier : 'retail',
        payment_method: paymentMethod,
        customer_id: selectedCustomerId || null,
        save_customer: !selectedCustomerId && saveCustomer && Boolean(customerName.trim()),
        customer_name:
          customerName.trim() ||
          (mode === 'service' ? 'عميل غسيل مباشر' : 'عميل نقدي - بيع سريع'),
        customer_phone: customerPhone.trim(),
        car_model: mode === 'service' ? carModel : undefined,
        car_plate: mode === 'service' ? carPlate : undefined,
        vehicle_tier: mode === 'service' ? vehicleTier : undefined,
        wash_bay: mode === 'service' ? washBay : undefined,
        created_by_staff_id: createdByCashierId,
        performed_by_staff_id:
          mode === 'service' ? performedByWasherId : performedBySellerId,
        discount_type: canApplyDiscount ? discountType : 'none',
        discount_value: canApplyDiscount ? discountValue : 0,
        notes: notes.trim() || undefined,
        items: activeCart.map((c) => ({
          item_type: c.item_type,
          service_id: c.service_id,
          product_id: c.product_id,
          item_name: c.item_name,
          unit_cost: c.unit_cost,
          unit_price: c.unit_price,
          quantity: c.quantity,
        })),
      });

      setActiveCart([]);
      setSelectedCustomerId('');
      setSaveCustomer(false);
      setCustomerName('');
      setCustomerPhone('');
      setCarModel('');
      setCarPlate('');
      setDiscountType('none');
      setDiscountValue(0);
      setNotes('');
      onInvoiceCreated(created);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Unmistakable Folder-Tab Header */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              نقطة البيع وإصدار الفواتير المنفصلة
            </h2>
            <p className="text-xs text-slate-600">
              اختر التبويب المناسب لنوع الفاتورة، ثم حدد الخدمات أو المنتجات (اختيار متعدد)، وتُحسب ضريبة {vatRate}% تلقائياً.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="نوع الفاتورة"
          className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'service'}
            onClick={() => handleModeSwitch('service')}
            className={`group px-4 py-2.5 rounded-t-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap border border-b-0 ${
              mode === 'service'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <CarFront className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>تبويب فاتورة خدمات غسيل (SRV)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'retail'}
            onClick={() => handleModeSwitch('retail')}
            className={`group px-4 py-2.5 rounded-t-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap border border-b-0 ${
              mode === 'retail'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Package className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>تبويب فاتورة بيع منتجات منفردة (RTL)</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Compact POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Multi-Select Checklist Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Vehicle Tier Selector when in Service Mode */}
          {mode === 'service' ? (
            <div className="bg-sky-50/85 border border-sky-200 rounded-2xl p-3.5 shadow-sm">
              <div className="text-xs font-bold text-slate-800 mb-2">
                1. فئة السيارة (تتحدث الأسعار تلقائياً):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(VEHICLE_TIER_LABELS) as VehicleTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => handleTierChange(tier)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                      vehicleTier === tier
                        ? 'bg-blue-700 text-white border-blue-800 shadow-md ring-2 ring-blue-500/25'
                        : 'bg-white/90 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-400 shadow-xs'
                    }`}
                  >
                    {VEHICLE_TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/85 border border-emerald-200 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">
                  1. فئة تسعير البيع (تتحدث الأسعار تلقائياً):
                </span>
                {!canSellWholesale && (
                  <span className="text-[11px] font-semibold text-amber-700">
                    صلاحية قطاعي فقط
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['retail', 'half_wholesale', 'wholesale'] as SaleTier[]).map((tier) => {
                  const locked = tier !== 'retail' && !canSellWholesale;
                  return (
                    <button
                      key={tier}
                      type="button"
                      disabled={locked}
                      onClick={() => handleSaleTierChange(tier)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                        saleTier === tier
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500/25'
                          : locked
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white/90 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 shadow-xs'
                      }`}
                    >
                      {SALE_TIER_LABELS[tier]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="bg-stone-100/85 border border-stone-300/80 rounded-2xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  id="pos-catalog-search"
                  name="pos-catalog-search"
                  type="text"
                  aria-label="بحث في خدمات الغسيل أو المنتجات"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    mode === 'service'
                      ? 'ابحث عن خدمة غسيل أو تلميع...'
                      : 'ابحث باسم المنتج أو كود SKU...'
                  }
                  className="w-full h-9 pr-9 pl-3 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="text-[11px] text-stone-700 flex items-center shrink-0 bg-white/80 px-3 py-1 rounded-xl border border-stone-200">
                تم اختيار <strong className="mx-1 font-mono-num text-blue-800">{activeCart.length}</strong> عنصر
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playSoundEffect('click');
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-white/90 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Multi-Select Checkbox List (Distinct soft tinted selectable cards with shadow & selection ring) */}
          <div className="bg-white/95 border border-slate-200 rounded-2xl p-3.5 shadow-sm">
            <div className="text-xs font-bold text-slate-800 mb-2.5 px-1 flex items-center justify-between">
              <span>
                {mode === 'service'
                  ? '2. حدد خدمات الغسيل المطلوبة (يمكنك اختيار أكثر من خدمة):'
                  : '2. حدد المنتجات المطلوبة للبيع (يمكنك اختيار أكثر من منتج):'}
              </span>
              {activeCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playSoundEffect('click');
                    setActiveCart([]);
                  }}
                  className="text-[11px] font-bold text-red-600 hover:underline"
                >
                  إلغاء تحديد الكل
                </button>
              )}
            </div>

            {mode === 'service' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredServices.map((svc) => {
                  const price = getServicePriceForTier(svc, vehicleTier);
                  const priceVat = calculatePriceWithVat(price, vatRate);
                  const isSelected = serviceCart.some((i) => i.service_id === svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleServiceSelection(svc)}
                      aria-pressed={isSelected}
                      className={`group text-right rounded-xl border px-3 py-2.5 transition-all flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-sky-100/90 border-blue-600 ring-2 ring-blue-500/25 shadow-md'
                          : 'bg-sky-50/60 border-sky-200 hover:bg-sky-100/75 hover:border-blue-400 shadow-xs hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-blue-700 border-blue-700 text-white scale-110'
                              : 'bg-white border-blue-300 group-hover:border-blue-500'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {svc.name_ar}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {svc.category} · <span className="font-mono-num">{svc.duration_minutes} د</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-xs font-bold text-blue-700 font-mono-num">
                          {formatEGP(price)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num">
                          +{vatRate}%: {formatEGP(priceVat)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredProducts.map((prod) => {
                  const tierPrice = getProductPriceForSaleTier(prod, saleTier);
                  const priceVat = calculatePriceWithVat(tierPrice, vatRate);
                  const outOfStock = prod.stock_qty <= 0;
                  const cartItem = retailCart.find((i) => i.product_id === prod.id);
                  const isSelected = Boolean(cartItem);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      disabled={outOfStock}
                      aria-pressed={isSelected}
                      onClick={() => !outOfStock && toggleProductSelection(prod)}
                      className={`group text-right rounded-xl border px-3 py-2.5 transition-all flex items-center justify-between gap-2.5 ${
                        outOfStock
                          ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-100/90 border-emerald-600 ring-2 ring-emerald-500/25 shadow-md'
                          : 'bg-emerald-50/55 border-emerald-200 hover:bg-emerald-100/70 hover:border-emerald-400 shadow-xs hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-700 border-emerald-700 text-white scale-110'
                              : 'bg-white border-emerald-300 group-hover:border-emerald-500'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {prod.name_ar}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            المتاح:{' '}
                            <strong
                              className={`font-mono-num ${
                                prod.stock_qty <= prod.min_stock_alert
                                  ? 'text-red-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {prod.stock_qty} {prod.unit}
                            </strong>{' '}
                            · {prod.brand}
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-xs font-bold text-emerald-700 font-mono-num">
                          {formatEGP(tierPrice)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num">
                          +{vatRate}%: {formatEGP(priceVat)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact Checkout & Invoice Builder Panel (5 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden lg:sticky lg:top-0"
        >
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${
              mode === 'service'
                ? 'bg-sky-100/80 border-sky-200'
                : 'bg-emerald-100/80 border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Receipt
                className={`w-4 h-4 ${
                  mode === 'service' ? 'text-blue-700' : 'text-emerald-700'
                }`}
              />
              <h3 className="text-sm font-bold text-slate-900">
                {mode === 'service'
                  ? 'ملخص فاتورة خدمات الغسيل'
                  : 'ملخص فاتورة مبيعات المنتجات'}
              </h3>
            </div>
            <span className="text-xs font-mono-num font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
              {activeCart.length} بند
            </span>
          </div>

          <div className="p-4 space-y-3">
            {/* Quick Customer Picker */}
            <div>
              <select
                id="pos-customer-select"
                name="pos-customer-select"
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                aria-label="اختيار عميل مسجل"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">-- اختيار عميل مسجل (اختياري) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.car_model} - {c.car_plate})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="pos-customer-name"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  اسم العميل
                </label>
                <input
                  id="pos-customer-name"
                  name="pos-customer-name"
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (selectedCustomerId) setSelectedCustomerId('');
                  }}
                  placeholder={mode === 'service' ? 'مثال: حسام إبراهيم' : 'عميل نقدي'}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label
                  htmlFor="pos-customer-phone"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  رقم الهاتف
                </label>
                <input
                  id="pos-customer-phone"
                  name="pos-customer-phone"
                  type="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01000000000"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {!selectedCustomerId && customerName.trim().length > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none">
                <input
                  id="pos-save-customer"
                  name="pos-save-customer"
                  type="checkbox"
                  checked={saveCustomer}
                  onChange={(e) => setSaveCustomer(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>حفظ بيانات العميل في سجل العملاء الدائمين</span>
              </label>
            )}

            {/* Service Vehicle Fields */}
            {mode === 'service' && (
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <label
                    htmlFor="pos-car-model"
                    className="block text-[10px] font-semibold text-slate-600 mb-1"
                  >
                    موديل السيارة
                  </label>
                  <input
                    id="pos-car-model"
                    name="pos-car-model"
                    type="text"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    placeholder="توسان 2024"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pos-car-plate"
                    className="block text-[10px] font-semibold text-slate-600 mb-1"
                  >
                    رقم اللوحة
                  </label>
                  <input
                    id="pos-car-plate"
                    name="pos-car-plate"
                    type="text"
                    value={carPlate}
                    onChange={(e) => setCarPlate(e.target.value)}
                    placeholder="أ ب ج 1234"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pos-wash-bay"
                    className="block text-[10px] font-semibold text-slate-600 mb-1"
                  >
                    الحارة
                  </label>
                  <select
                    id="pos-wash-bay"
                    name="pos-wash-bay"
                    value={washBay}
                    onChange={(e) => setWashBay(e.target.value)}
                    className="w-full h-8 px-1.5 rounded-md border border-slate-200 bg-white text-[11px]"
                  >
                    {WASH_BAYS.map((bay) => (
                      <option key={bay} value={bay}>
                        {bay}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Staff Accountability */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor={mode === 'service' ? 'pos-washer-id' : 'pos-seller-id'}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 mb-1"
                >
                  <UserCheck className="w-3 h-3 text-slate-400" />
                  <span>{mode === 'service' ? 'القائم بالغسيل' : 'البائع / المخزن'}</span>
                </label>
                {mode === 'service' ? (
                  <select
                    id="pos-washer-id"
                    name="pos-washer-id"
                    value={performedByWasherId}
                    onChange={(e) => setPerformedByWasherId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    {washers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="pos-seller-id"
                    name="pos-seller-id"
                    value={performedBySellerId}
                    onChange={(e) => setPerformedBySellerId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label
                  htmlFor="pos-cashier-id"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  الكاشير (مصدر الفاتورة)
                </label>
                <select
                  id="pos-cashier-id"
                  name="pos-cashier-id"
                  value={createdByCashierId}
                  onChange={(e) => setCreatedByCashierId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  {cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Items Summary */}
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-44 overflow-y-auto">
              {activeCart.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-slate-500">
                  {mode === 'service'
                    ? 'حدد خدمة أو أكثر من القائمة الجانبية لإضافتها هنا.'
                    : 'حدد منتجاً أو أكثر من القائمة الجانبية لإضافته هنا.'}
                </div>
              ) : (
                activeCart.map((item) => (
                  <div
                    key={item.key}
                    className="p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.item_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-num">
                        {formatEGP(item.unit_price)} × {item.quantity} ={' '}
                        <strong className="text-slate-900">
                          {formatEGP(item.unit_price * item.quantity)}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, -1)}
                        className="w-6 h-6 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-mono-num font-bold text-[11px]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, 1)}
                        className="w-6 h-6 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, -item.quantity)}
                        aria-label="حذف البند"
                        className="w-6 h-6 rounded text-red-600 hover:bg-red-50 flex items-center justify-center mr-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Discount & Payment Method */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="pos-discount-type"
                  className="block text-[10px] font-semibold text-slate-600 mb-1"
                >
                  الخصم {!canApplyDiscount && '(مقفل)'}
                </label>
                <select
                  id="pos-discount-type"
                  name="pos-discount-type"
                  disabled={!canApplyDiscount}
                  value={canApplyDiscount ? discountType : 'none'}
                  onChange={(e) => {
                    const next = e.target.value as DiscountType;
                    setDiscountType(next);
                    if (next === 'none') setDiscountValue(0);
                  }}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white disabled:bg-slate-100"
                >
                  <option value="none">بدون خصم</option>
                  <option value="percent">نسبة %</option>
                  <option value="fixed">مبلغ ج.م</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="pos-discount-value"
                  className="block text-[10px] font-semibold text-slate-600 mb-1"
                >
                  القيمة
                </label>
                <input
                  id="pos-discount-value"
                  name="pos-discount-value"
                  type="number"
                  min={0}
                  step="any"
                  disabled={!canApplyDiscount || discountType === 'none'}
                  value={!canApplyDiscount || discountType === 'none' ? 0 : discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono-num disabled:bg-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="pos-payment-method"
                  className="block text-[10px] font-semibold text-slate-600 mb-1"
                >
                  طريقة الدفع
                </label>
                <select
                  id="pos-payment-method"
                  name="pos-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  {paymentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              id="pos-invoice-notes"
              name="pos-invoice-notes"
              type="text"
              aria-label="ملاحظات الفاتورة"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات الفاتورة (اختياري)..."
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
            />

            {/* Financial Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع قبل الضريبة</span>
                <span className="font-mono-num">{formatEGP(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>الخصم</span>
                  <span className="font-mono-num">- {formatEGP(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة ({vatRate}%)</span>
                <span className="font-mono-num">{formatEGP(totals.vatAmount)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>الإجمالي النهائي</span>
                <span className="font-mono-num">{formatEGP(totals.totalAmount)}</span>
              </div>
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`group btn-sheen w-full h-10 rounded-xl text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 ${
                mode === 'service'
                  ? 'bg-blue-700 hover:bg-blue-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              } disabled:opacity-60`}
            >
              <Receipt className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>
                {submitting
                  ? 'جاري الحفظ...'
                  : mode === 'service'
                  ? 'إصدار ومعاينة فاتورة الغسيل'
                  : 'إصدار ومعاينة فاتورة البيع'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
