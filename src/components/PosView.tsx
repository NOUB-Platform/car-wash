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
  StaffMember,
  VehicleTier,
  WashService,
} from '../types/carwash';
import {
  calculateInvoiceTotals,
  calculatePriceWithVat,
  formatEGP,
  getServicePriceForTier,
  PAYMENT_METHOD_LABELS,
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
  vatRate: number;
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
  vatRate,
  onCreateInvoice,
  onInvoiceCreated,
}) => {
  const [mode, setMode] = useState<InvoiceType>(initialMode);
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
    cashiers[0]?.id || staff[1]?.id || staff[0]?.id || ''
  );

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
    setMode(nextMode);
    setSelectedCategory('الكل');
    setSearchTerm('');
    setFormError(null);
  };

  const handleTierChange = (nextTier: VehicleTier) => {
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

  // Multi-select checkbox toggle for wash services
  const toggleServiceSelection = (svc: WashService) => {
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
      setFormError(`المنتج "${prod.name_ar}" غير متوفر بالمخزن حالياً.`);
      return;
    }
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
          unit_price: prod.selling_price,
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
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setCustomerName(cust.full_name);
    setCustomerPhone(cust.phone);
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

    setSubmitting(true);
    try {
      const created = await onCreateInvoice({
        invoice_type: mode,
        payment_method: paymentMethod,
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
        discount_type: discountType,
        discount_value: discountValue,
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
      {/* Compact Mode Switcher Header */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            نقطة البيع وإصدار الفواتير المنفصلة
          </h2>
          <p className="text-xs text-slate-500">
            اختر الخدمات أو المنتجات بالضغط على مربع الاختيار (اختيار متعدد)، وتُحسب ضريبة {vatRate}% تلقائياً.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleModeSwitch('service')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              mode === 'service'
                ? 'bg-blue-700 text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <CarFront className="w-3.5 h-3.5" />
            <span>فاتورة خدمات غسيل (SRV)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('retail')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              mode === 'retail'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>فاتورة بيع منتجات منفردة (RTL)</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Compact POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Multi-Select Checklist Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Vehicle Tier Selector when in Service Mode */}
          {mode === 'service' && (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-xs font-bold text-slate-700 mb-2">
                1. فئة السيارة (تتحدث الأسعار تلقائياً):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(VEHICLE_TIER_LABELS) as VehicleTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => handleTierChange(tier)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                      vehicleTier === tier
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {VEHICLE_TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    mode === 'service'
                      ? 'ابحث عن خدمة غسيل أو تلميع...'
                      : 'ابحث باسم المنتج أو كود SKU...'
                  }
                  className="w-full h-9 pr-9 pl-3 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="text-[11px] text-slate-500 flex items-center shrink-0">
                تم اختيار <strong className="mx-1 font-mono-num text-slate-900">{activeCart.length}</strong> عنصر
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Multi-Select Checkbox List (Distinct subtle tinted rows) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-700 mb-2.5 px-1 flex items-center justify-between">
              <span>
                {mode === 'service'
                  ? '2. حدد خدمات الغسيل المطلوبة (يمكنك اختيار أكثر من خدمة):'
                  : '2. حدد المنتجات المطلوبة للبيع (يمكنك اختيار أكثر من منتج):'}
              </span>
              {activeCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCart([])}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  إلغاء تحديد الكل
                </button>
              )}
            </div>

            {mode === 'service' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      className={`text-right rounded-lg border px-3 py-2.5 transition-colors flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600'
                          : 'bg-slate-50/90 border-slate-200 hover:bg-blue-50/40 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {svc.name_ar}
                          </div>
                          <div className="text-[11px] text-slate-500">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredProducts.map((prod) => {
                  const priceVat = calculatePriceWithVat(prod.selling_price, vatRate);
                  const outOfStock = prod.stock_qty <= 0;
                  const cartItem = retailCart.find((i) => i.product_id === prod.id);
                  const isSelected = Boolean(cartItem);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => !outOfStock && toggleProductSelection(prod)}
                      role="button"
                      tabIndex={outOfStock ? -1 : 0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !outOfStock) {
                          e.preventDefault();
                          toggleProductSelection(prod);
                        }
                      }}
                      className={`text-right rounded-lg border px-3 py-2.5 transition-colors flex items-center justify-between gap-2.5 ${
                        outOfStock
                          ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-50 border-emerald-600 cursor-pointer'
                          : 'bg-slate-50/90 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {prod.name_ar}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            المتاح:{' '}
                            <strong
                              className={`font-mono-num ${
                                prod.stock_qty <= prod.min_stock_alert
                                  ? 'text-red-600'
                                  : 'text-slate-700'
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
                          {formatEGP(prod.selling_price)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num">
                          +{vatRate}%: {formatEGP(priceVat)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact Checkout & Invoice Builder Panel (5 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-20"
        >
          <div
            className={`px-4 py-3 border-b border-slate-200 flex items-center justify-between ${
              mode === 'service' ? 'bg-blue-50/70' : 'bg-emerald-50/70'
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
            <span className="text-xs font-mono-num font-semibold text-slate-600">
              {activeCart.length} بند
            </span>
          </div>

          <div className="p-4 space-y-3">
            {/* Quick Customer Picker */}
            <div>
              <select
                defaultValue=""
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
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  اسم العميل
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={mode === 'service' ? 'مثال: حسام إبراهيم' : 'عميل نقدي'}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01000000000"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Service Vehicle Fields */}
            {mode === 'service' && (
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    موديل السيارة
                  </label>
                  <input
                    type="text"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    placeholder="توسان 2024"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    رقم اللوحة
                  </label>
                  <input
                    type="text"
                    value={carPlate}
                    onChange={(e) => setCarPlate(e.target.value)}
                    placeholder="أ ب ج 1234"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    الحارة
                  </label>
                  <select
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
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-slate-400" />
                  <span>{mode === 'service' ? 'القائم بالغسيل' : 'البائع / المخزن'}</span>
                </label>
                {mode === 'service' ? (
                  <select
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
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  الكاشير (مصدر الفاتورة)
                </label>
                <select
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
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  الخصم
                </label>
                <select
                  value={discountType}
                  onChange={(e) => {
                    const next = e.target.value as DiscountType;
                    setDiscountType(next);
                    if (next === 'none') setDiscountValue(0);
                  }}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="none">بدون خصم</option>
                  <option value="percent">نسبة %</option>
                  <option value="fixed">مبلغ ج.م</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  القيمة
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={discountType === 'none'}
                  value={discountType === 'none' ? 0 : discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono-num disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  طريقة الدفع
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((pm) => (
                    <option key={pm} value={pm}>
                      {PAYMENT_METHOD_LABELS[pm]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              type="text"
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
              className={`w-full h-10 rounded-lg text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === 'service'
                  ? 'bg-blue-700 hover:bg-blue-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              } disabled:opacity-60`}
            >
              <Receipt className="w-4 h-4" />
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
