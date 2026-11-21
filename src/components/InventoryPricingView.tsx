import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  Barcode,
  CarFront,
  Edit3,
  FileSpreadsheet,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  PricingMode,
  Product,
  StaffMember,
  StockMovement,
  StockMovementType,
  WashService,
} from '../types/carwash';
import { exportToExcelXls } from '../utils/excelExport';
import { playSoundEffect } from '../utils/feedback';
import {
  calculatePriceWithVat,
  calculateProductSellingPrice,
  formatDateTimeAr,
  formatEGP,
  roundMoney,
  STOCK_MOVEMENT_LABELS,
} from '../utils/pricing';
import { BarcodePrintModal } from './BarcodePrintModal';

interface InventoryPricingViewProps {
  products: Product[];
  services: WashService[];
  staff: StaffMember[];
  stockMovements: StockMovement[];
  vatRate: number;
  businessName: string;
  canViewProfits: boolean;
  canExportExcel: boolean;
  onUpsertProduct: (
    data: Omit<Product, 'id' | 'created_at'> & { id?: string }
  ) => Promise<void>;
  onAdjustStock: (params: {
    product_id: string;
    movement_type: StockMovementType;
    quantity_change: number;
    performed_by_staff_id: string;
    notes: string;
  }) => Promise<void>;
  onUpsertService: (
    data: Omit<WashService, 'id' | 'created_at'> & { id?: string }
  ) => Promise<void>;
}

export const InventoryPricingView: React.FC<InventoryPricingViewProps> = ({
  products,
  services,
  staff,
  stockMovements,
  vatRate,
  businessName,
  canViewProfits,
  canExportExcel,
  onUpsertProduct,
  onAdjustStock,
  onUpsertService,
}) => {
  const [subTab, setSubTab] = useState<'products' | 'services' | 'movements'>('products');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Barcode Modal
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeInitialProduct, setBarcodeInitialProduct] = useState<Product | null>(null);

  // Product Add/Edit Modal
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>('restock');
  const [adjustQty, setAdjustQty] = useState<number>(5);
  const [adjustStaffId, setAdjustStaffId] = useState<string>(staff[4]?.id || staff[0]?.id || '');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  // Service Edit Modal
  const [editingService, setEditingService] = useState<Partial<WashService> | null>(null);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock_qty <= p.min_stock_alert).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (lowStockOnly && p.stock_qty > p.min_stock_alert) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        p.name_ar.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.warehouse_name || '').toLowerCase().includes(q)
      );
    });
  }, [products, search, lowStockOnly]);

  const inventoryValuation = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        acc.totalCost += p.cost_price * p.stock_qty;
        acc.totalRetail += p.selling_price * p.stock_qty;
        acc.totalUnits += p.stock_qty;
        return acc;
      },
      { totalCost: 0, totalRetail: 0, totalUnits: 0 }
    );
  }, [products]);

  const getStaffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.full_name || '—';

  const openNewProduct = () => {
    const nextSku = `PRD-${String(products.length + 1).padStart(3, '0')}`;
    setEditingProduct({
      sku: nextSku,
      barcode: `622000${String(products.length + 101)}`,
      warehouse_name: 'المخزن الرئيسي - الهرم',
      name_ar: '',
      brand: '',
      category: 'منظفات خارجية',
      unit: 'عبوة',
      cost_price: 100,
      pricing_mode: 'markup_percent',
      markup_value: 35,
      selling_price: 135,
      half_wholesale_price: 124,
      wholesale_price: 115,
      stock_qty: 10,
      min_stock_alert: 5,
      supplier_name: '',
      is_for_sale: true,
      is_consumable: false,
      vat_applicable: true,
    });
  };

  const handleProductFieldChange = (patch: Partial<Product>) => {
    setEditingProduct((prev) => {
      if (!prev) return null;
      const merged = { ...prev, ...patch };
      const cost = Number(merged.cost_price) || 0;
      const mode = (merged.pricing_mode || 'markup_percent') as PricingMode;
      const markupVal = Number(merged.markup_value) || 0;
      const manual = Number(merged.selling_price) || 0;

      const computedPrice =
        mode === 'manual'
          ? roundMoney(manual)
          : calculateProductSellingPrice(cost, mode, markupVal);

      const priceChanged =
        patch.cost_price !== undefined ||
        patch.pricing_mode !== undefined ||
        patch.markup_value !== undefined ||
        patch.selling_price !== undefined;

      return {
        ...merged,
        selling_price: computedPrice,
        half_wholesale_price:
          patch.half_wholesale_price !== undefined
            ? patch.half_wholesale_price
            : priceChanged
            ? roundMoney(Math.max(cost, computedPrice * 0.92))
            : merged.half_wholesale_price,
        wholesale_price:
          patch.wholesale_price !== undefined
            ? patch.wholesale_price
            : priceChanged
            ? roundMoney(Math.max(cost, computedPrice * 0.85))
            : merged.wholesale_price,
      };
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name_ar?.trim()) return;
    const sku = editingProduct.sku || `PRD-${Date.now().toString().slice(-4)}`;
    const retailPrice = Number(editingProduct.selling_price) || 0;
    const cost = Number(editingProduct.cost_price) || 0;

    await onUpsertProduct({
      id: editingProduct.id,
      sku,
      barcode: editingProduct.barcode?.trim() || sku,
      warehouse_name: editingProduct.warehouse_name?.trim() || 'المخزن الرئيسي - الهرم',
      name_ar: editingProduct.name_ar.trim(),
      brand: editingProduct.brand || 'عام',
      category: editingProduct.category || 'منظفات خارجية',
      unit: editingProduct.unit || 'عبوة',
      cost_price: cost,
      pricing_mode: (editingProduct.pricing_mode || 'markup_percent') as PricingMode,
      markup_value:
        editingProduct.pricing_mode === 'manual'
          ? retailPrice
          : Number(editingProduct.markup_value) || 0,
      selling_price: retailPrice,
      half_wholesale_price:
        Number(editingProduct.half_wholesale_price) ||
        roundMoney(Math.max(cost, retailPrice * 0.92)),
      wholesale_price:
        Number(editingProduct.wholesale_price) ||
        roundMoney(Math.max(cost, retailPrice * 0.85)),
      stock_qty: Number(editingProduct.stock_qty) || 0,
      min_stock_alert: Number(editingProduct.min_stock_alert) || 5,
      supplier_name: editingProduct.supplier_name || '',
      is_for_sale: editingProduct.is_for_sale ?? true,
      is_consumable: editingProduct.is_consumable ?? false,
      vat_applicable: editingProduct.vat_applicable ?? true,
    });
    setEditingProduct(null);
  };

  const handleExportProductsExcel = () => {
    playSoundEffect('click');
    exportToExcelXls<Product>({
      filename: 'perfect_inventory',
      sheetTitle: 'جرد المخزن والأسعار',
      columns: [
        { header: 'SKU', value: (p) => p.sku },
        { header: 'الباركود', value: (p) => p.barcode || p.sku },
        { header: 'الصنف', value: (p) => p.name_ar },
        { header: 'المخزن', value: (p) => p.warehouse_name || 'المخزن الرئيسي' },
        { header: 'الماركة', value: (p) => p.brand },
        { header: 'الرصيد', value: (p) => `${p.stock_qty} ${p.unit}` },
        { header: 'حد النواقص', value: (p) => p.min_stock_alert },
        ...(canViewProfits ? [{ header: 'التكلفة', value: (p: Product) => p.cost_price }] : []),
        { header: 'سعر قطاعي', value: (p) => p.selling_price },
        { header: 'سعر نص جملة', value: (p) => p.half_wholesale_price ?? p.selling_price },
        { header: 'سعر جملة', value: (p) => p.wholesale_price ?? p.selling_price },
        {
          header: `شامل ضريبة ${vatRate}%`,
          value: (p) => calculatePriceWithVat(p.selling_price, vatRate),
        },
      ],
      rows: filteredProducts,
    });
  };

  const handleSubmitAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || adjustQty <= 0) return;

    const signedChange =
      adjustType === 'restock' ? Math.abs(adjustQty) : -Math.abs(adjustQty);

    await onAdjustStock({
      product_id: adjustingProduct.id,
      movement_type: adjustType,
      quantity_change: signedChange,
      performed_by_staff_id: adjustStaffId,
      notes:
        adjustNotes.trim() ||
        `${STOCK_MOVEMENT_LABELS[adjustType]} - ${adjustingProduct.name_ar}`,
    });
    setAdjustingProduct(null);
    setAdjustNotes('');
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editingService.name_ar?.trim()) return;
    await onUpsertService({
      id: editingService.id,
      code: editingService.code || `SRV-${Date.now().toString().slice(-3)}`,
      name_ar: editingService.name_ar.trim(),
      category: editingService.category || 'غسيل أساسي',
      duration_minutes: Number(editingService.duration_minutes) || 30,
      price_sedan: Number(editingService.price_sedan) || 0,
      price_suv: Number(editingService.price_suv) || 0,
      price_4x4: Number(editingService.price_4x4) || 0,
      price_van: Number(editingService.price_van) || 0,
      vat_applicable: true,
      is_active: editingService.is_active ?? true,
    });
    setEditingService(null);
  };

  return (
    <div className="space-y-5">
      {/* Header & Unmistakable Folder-Tab Strip */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="pb-3">
          <h2 className="text-lg font-bold text-slate-900">المخزن وتسعير الخدمات والمنتجات</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            تسعير المنتجات بالتكلفة + نسبة المكسب أو الربح الثابت، وإدارة أسعار الغسيل حسب فئة السيارة.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="أقسام المخزن والتسعير"
          className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'products'}
            onClick={() => setSubTab('products')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
              subTab === 'products'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>مخزن المنتجات ({products.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'services'}
            onClick={() => setSubTab('services')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
              subTab === 'services'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <CarFront className="w-3.5 h-3.5" />
            <span>أسعار خدمات الغسيل</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'movements'}
            onClick={() => setSubTab('movements')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
              subTab === 'movements'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>حركات المخزن</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: Products & Cost/Profit Pricing */}
      {subTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/75 border border-emerald-200 rounded-2xl shadow-sm p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs bg-white/85 px-3.5 py-2 rounded-xl border border-emerald-200">
              <div>
                <span className="text-slate-600">إجمالي القطع: </span>
                <strong className="font-mono-num text-slate-900">
                  {inventoryValuation.totalUnits} قطعة
                </strong>
              </div>
              {canViewProfits && (
                <div>
                  <span className="text-slate-600">قيمة المخزن بالتكلفة: </span>
                  <strong className="font-mono-num text-slate-900">
                    {formatEGP(inventoryValuation.totalCost)}
                  </strong>
                </div>
              )}
              <div>
                <span className="text-slate-600">القيمة البيعية: </span>
                <strong className="font-mono-num text-emerald-700">
                  {formatEGP(inventoryValuation.totalRetail)}
                </strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  id="inventory-search"
                  name="inventory-search"
                  type="text"
                  aria-label="بحث عن منتج أو SKU أو باركود"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث باسم المنتج أو الباركود..."
                  className="h-9 pr-9 pl-3 rounded-xl border border-emerald-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  playSoundEffect('click');
                  setLowStockOnly((prev) => !prev);
                }}
                className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  lowStockOnly
                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                    : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>النواقص ({lowStockCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSoundEffect('click');
                  setBarcodeInitialProduct(null);
                  setBarcodeModalOpen(true);
                }}
                className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-900 hover:text-white text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <Barcode className="w-4 h-4" />
                <span>طباعة باركود</span>
              </button>

              {canExportExcel && (
                <button
                  type="button"
                  onClick={handleExportProductsExcel}
                  className="h-9 px-3 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير إكسيل</span>
                </button>
              )}

              <button
                type="button"
                onClick={openNewProduct}
                className="group btn-sheen h-9 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                <span>إضافة منتج</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-315px)] min-h-[280px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-semibold min-w-[200px] whitespace-nowrap">الكود والمنتج</th>
                    <th className="py-2.5 px-3 text-right font-semibold min-w-[130px] whitespace-nowrap">الماركة والمخزن</th>
                    <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">الرصيد</th>
                    {canViewProfits && (
                      <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">التكلفة</th>
                    )}
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">قطاعي</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">نص جملة</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">جملة</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">شامل {vatRate}%</th>
                    {canViewProfits && (
                      <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">الربح/قطعة</th>
                    )}
                    <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProducts.map((prod) => {
                    const isLow = prod.stock_qty <= prod.min_stock_alert;
                    const profit = roundMoney(prod.selling_price - prod.cost_price);
                    const priceWithVat = calculatePriceWithVat(prod.selling_price, vatRate);
                    const halfWholesale =
                      prod.half_wholesale_price ||
                      roundMoney(Math.max(prod.cost_price, prod.selling_price * 0.92));
                    const wholesale =
                      prod.wholesale_price ||
                      roundMoney(Math.max(prod.cost_price, prod.selling_price * 0.85));
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 min-w-[200px]">
                          <div className="font-semibold text-slate-900 whitespace-nowrap">{prod.name_ar}</div>
                          <div className="text-[11px] text-slate-500 font-mono-num whitespace-nowrap">
                            {prod.sku} · باركود: {prod.barcode || prod.sku}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 min-w-[130px]">
                          <div className="whitespace-nowrap">{prod.brand} · {prod.category}</div>
                          <div className="text-[11px] text-slate-400 whitespace-nowrap">
                            {prod.warehouse_name || 'المخزن الرئيسي'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`font-mono-num font-bold ${
                              isLow ? 'text-red-600' : 'text-slate-900'
                            }`}
                          >
                            {prod.stock_qty} {prod.unit}
                          </span>
                          {isLow && (
                            <div className="text-[11px] text-red-600 font-medium">
                              نقص مخزون
                            </div>
                          )}
                        </td>
                        {canViewProfits && (
                          <td className="py-2.5 px-3 text-left font-mono-num text-slate-600 whitespace-nowrap">
                            {formatEGP(prod.cost_price)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-left font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatEGP(prod.selling_price)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num text-slate-700 whitespace-nowrap">
                          {formatEGP(halfWholesale)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num text-indigo-700 font-semibold whitespace-nowrap">
                          {formatEGP(wholesale)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num font-bold text-blue-700 whitespace-nowrap">
                          {formatEGP(priceWithVat)}
                        </td>
                        {canViewProfits && (
                          <td className="py-2.5 px-3 text-left font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                            + {formatEGP(profit)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBarcodeInitialProduct(prod);
                                setBarcodeModalOpen(true);
                              }}
                              title="طباعة باركود الصنف"
                              aria-label="طباعة باركود الصنف"
                              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-700 transition-all"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingProduct(prod);
                                setAdjustType('restock');
                                setAdjustQty(5);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-xs font-semibold text-blue-700 transition-all"
                            >
                              توريد/صرف
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProduct(prod)}
                              aria-label="تعديل المنتج"
                              className="group p-1.5 rounded-lg border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-blue-700 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Wash Services Price Matrix */}
      {subTab === 'services' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setEditingService({
                  code: `SRV-${services.length + 1}`,
                  name_ar: '',
                  category: 'غسيل أساسي',
                  duration_minutes: 30,
                  price_sedan: 150,
                  price_suv: 190,
                  price_4x4: 220,
                  price_van: 260,
                  is_active: true,
                })
              }
              className="group btn-sheen h-9 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>إضافة خدمة غسيل جديدة</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-sky-100 border-b border-sky-200 text-xs text-slate-800 sticky top-0 z-10 shadow-[0_1px_0_0_#bae6fd]">
                  <tr>
                    <th className="py-3 px-4 text-right font-semibold">الخدمة</th>
                    <th className="py-3 px-4 text-right font-semibold">التصنيف</th>
                    <th className="py-3 px-4 text-center font-semibold">المدة</th>
                    <th className="py-3 px-4 text-left font-semibold">سيدان</th>
                    <th className="py-3 px-4 text-left font-semibold">SUV</th>
                    <th className="py-3 px-4 text-left font-semibold">دفع رباعي 4x4</th>
                    <th className="py-3 px-4 text-left font-semibold">فان / ميكروباص</th>
                    <th className="py-3 px-4 text-center font-semibold">تعديل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {services.map((svc) => (
                    <tr key={svc.id} className="hover:bg-blue-50/45 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{svc.name_ar}</div>
                        <div className="text-xs text-slate-500 font-mono-num">{svc.code}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{svc.category}</td>
                      <td className="py-3 px-4 text-center font-mono-num text-xs text-slate-600">
                        {svc.duration_minutes} د
                      </td>
                      <td className="py-3 px-4 text-left font-mono-num font-semibold text-slate-900">
                        {formatEGP(svc.price_sedan)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono-num font-semibold text-slate-900">
                        {formatEGP(svc.price_suv)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono-num font-semibold text-slate-900">
                        {formatEGP(svc.price_4x4)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono-num font-semibold text-slate-900">
                        {formatEGP(svc.price_van)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingService(svc)}
                          className="group p-1.5 rounded-lg border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-blue-700 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Stock Movements Audit */}
      {subTab === 'movements' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[280px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 text-xs text-slate-700 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                <tr>
                  <th className="py-3 px-4 text-right font-semibold">التاريخ</th>
                  <th className="py-3 px-4 text-right font-semibold">المنتج</th>
                  <th className="py-3 px-4 text-right font-semibold">نوع الحركة</th>
                  <th className="py-3 px-4 text-center font-semibold">الكمية</th>
                  <th className="py-3 px-4 text-right font-semibold">المسؤول</th>
                  <th className="py-3 px-4 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTimeAr(m.created_at)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {m.product_name || 'منتج'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {STOCK_MOVEMENT_LABELS[m.movement_type]}
                    </td>
                    <td
                      className={`py-3 px-4 text-center font-mono-num font-bold ${
                        m.quantity_change > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {getStaffName(m.performed_by_staff_id)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Product with Cost + Profit Pricing Calculator */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden my-6"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct.id ? 'تعديل منتج وتسعير' : 'إضافة منتج جديد للمخزن'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    اسم المنتج
                  </label>
                  <input
                    required
                    type="text"
                    value={editingProduct.name_ar || ''}
                    onChange={(e) => handleProductFieldChange({ name_ar: e.target.value })}
                    placeholder="مثال: سبراي غسيل جاف 500 مل"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    كود SKU
                  </label>
                  <input
                    required
                    type="text"
                    dir="ltr"
                    value={editingProduct.sku || ''}
                    onChange={(e) => handleProductFieldChange({ sku: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    الماركة
                  </label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={(e) => handleProductFieldChange({ brand: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    التصنيف
                  </label>
                  <input
                    type="text"
                    value={editingProduct.category || ''}
                    onChange={(e) => handleProductFieldChange({ category: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    الوحدة
                  </label>
                  <input
                    type="text"
                    value={editingProduct.unit || 'عبوة'}
                    onChange={(e) => handleProductFieldChange({ unit: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    رقم الباركود (Code-39)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingProduct.barcode || ''}
                    onChange={(e) => handleProductFieldChange({ barcode: e.target.value })}
                    placeholder="مثال: 622000101"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    اسم المخزن / الرف
                  </label>
                  <input
                    type="text"
                    value={editingProduct.warehouse_name || ''}
                    onChange={(e) => handleProductFieldChange({ warehouse_name: e.target.value })}
                    placeholder="المخزن الرئيسي - الهرم"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Cost + Profit Strategy Box */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  حاسبة تسعير المنتج (قطاعي / نص جملة / جملة + ضريبة {vatRate}%)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      سعر التكلفة (ج.م)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editingProduct.cost_price ?? 0}
                      onChange={(e) =>
                        handleProductFieldChange({ cost_price: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      طريقة حساب المكسب
                    </label>
                    <select
                      value={editingProduct.pricing_mode || 'markup_percent'}
                      onChange={(e) =>
                        handleProductFieldChange({
                          pricing_mode: e.target.value as PricingMode,
                        })
                      }
                      className="w-full h-9 px-2 rounded-md border border-slate-200 bg-white text-xs"
                    >
                      <option value="markup_percent">نسبة مكسب %</option>
                      <option value="markup_fixed">مبلغ ربح ثابت ج.م</option>
                      <option value="manual">سعر بيع مباشر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {editingProduct.pricing_mode === 'markup_percent'
                        ? 'نسبة المكسب (%)'
                        : editingProduct.pricing_mode === 'markup_fixed'
                        ? 'مبلغ الربح (ج.م)'
                        : 'سعر البيع المباشر'}
                    </label>
                    {editingProduct.pricing_mode === 'manual' ? (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={editingProduct.selling_price ?? 0}
                        onChange={(e) =>
                          handleProductFieldChange({
                            selling_price: Number(e.target.value) || 0,
                            markup_value: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={editingProduct.markup_value ?? 0}
                        onChange={(e) =>
                          handleProductFieldChange({
                            markup_value: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      سعر نص جملة (ج.م)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editingProduct.half_wholesale_price ?? 0}
                      onChange={(e) =>
                        handleProductFieldChange({
                          half_wholesale_price: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      سعر الجملة (ج.م)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editingProduct.wholesale_price ?? 0}
                      onChange={(e) =>
                        handleProductFieldChange({
                          wholesale_price: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono-num"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">سعر البيع قطاعي</span>
                    <strong className="font-mono-num text-slate-900">
                      {formatEGP(editingProduct.selling_price || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">شامل ضريبة {vatRate}%</span>
                    <strong className="font-mono-num text-blue-700">
                      {formatEGP(
                        calculatePriceWithVat(editingProduct.selling_price || 0, vatRate)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">صافي ربح القطعة</span>
                    <strong className="font-mono-num text-emerald-700">
                      {formatEGP(
                        (editingProduct.selling_price || 0) - (editingProduct.cost_price || 0)
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    الكمية الحالية
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.stock_qty ?? 0}
                    onChange={(e) =>
                      handleProductFieldChange({ stock_qty: Number(e.target.value) || 0 })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    تنبيه الحد الأدنى
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.min_stock_alert ?? 5}
                    onChange={(e) =>
                      handleProductFieldChange({
                        min_stock_alert: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    اسم المورد
                  </label>
                  <input
                    type="text"
                    value={editingProduct.supplier_name || ''}
                    onChange={(e) =>
                      handleProductFieldChange({ supplier_name: e.target.value })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
              >
                حفظ المنتج والتسعير
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Stock Movement (Restock / Wash Usage) */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAdjustStock}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">تحديث رصيد المخزن</h3>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{adjustingProduct.name_ar}</div>
                <div className="text-slate-500 mt-1">
                  الرصيد الحالي:{' '}
                  <strong className="font-mono-num text-slate-900">
                    {adjustingProduct.stock_qty} {adjustingProduct.unit}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">نوع الحركة</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as StockMovementType)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="restock">توريد وارد للمخزن (+)</option>
                  <option value="wash_usage">صرف مستهلكات تشغيل المغسلة (-)</option>
                  <option value="adjustment">تسوية عجز / تالف (-)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الكمية</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value) || 1)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الموظف المسؤول</label>
                  <select
                    value={adjustStaffId}
                    onChange={(e) => setAdjustStaffId(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">ملاحظات الحركة</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="مثال: فاتورة شراء رقم 401 أو صرف حارة 1..."
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                تأكيد الحركة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Wash Service */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveService}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingService.id ? 'تعديل تسعير خدمة الغسيل' : 'إضافة خدمة غسيل جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">اسم الخدمة</label>
                  <input
                    required
                    type="text"
                    value={editingService.name_ar || ''}
                    onChange={(e) =>
                      setEditingService((p) => ({ ...p, name_ar: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">المدة (دقيقة)</label>
                  <input
                    type="number"
                    min={5}
                    value={editingService.duration_minutes ?? 30}
                    onChange={(e) =>
                      setEditingService((p) => ({
                        ...p,
                        duration_minutes: Number(e.target.value) || 30,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">سعر سيدان</label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.price_sedan ?? 0}
                    onChange={(e) =>
                      setEditingService((p) => ({
                        ...p,
                        price_sedan: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">سعر SUV</label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.price_suv ?? 0}
                    onChange={(e) =>
                      setEditingService((p) => ({
                        ...p,
                        price_suv: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">سعر 4x4</label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.price_4x4 ?? 0}
                    onChange={(e) =>
                      setEditingService((p) => ({
                        ...p,
                        price_4x4: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">سعر فان</label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.price_van ?? 0}
                    onChange={(e) =>
                      setEditingService((p) => ({
                        ...p,
                        price_van: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
              >
                حفظ الأسعار
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Barcode Print Modal */}
      {barcodeModalOpen && (
        <BarcodePrintModal
          products={products}
          initialProduct={barcodeInitialProduct}
          vatRate={vatRate}
          businessName={businessName}
          onClose={() => setBarcodeModalOpen(false)}
        />
      )}
    </div>
  );
};
