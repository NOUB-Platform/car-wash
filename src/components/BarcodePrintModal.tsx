import React, { useMemo, useState } from 'react';
import { ArrowRight, Barcode, Minus, Plus, Printer, X } from 'lucide-react';
import { Product } from '../types/carwash';
import { generateCode39Bars } from '../utils/barcode';
import { calculatePriceWithVat, formatEGP } from '../utils/pricing';

interface BarcodePrintModalProps {
  products: Product[];
  initialProduct?: Product | null;
  vatRate: number;
  businessName: string;
  onClose: () => void;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  products,
  initialProduct,
  vatRate,
  businessName,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialProduct ? [initialProduct.id] : products.slice(0, 4).map((p) => p.id)
  );
  const [copiesPerProduct, setCopiesPerProduct] = useState<number>(initialProduct ? 6 : 2);
  const [includePrice, setIncludePrice] = useState<boolean>(true);
  const [includeVatPrice, setIncludeVatPrice] = useState<boolean>(true);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const labels = useMemo(() => {
    const out: Array<{ key: string; product: Product }> = [];
    selectedProducts.forEach((product) => {
      for (let i = 0; i < copiesPerProduct; i += 1) {
        out.push({ key: `${product.id}-${i}`, product });
      }
    });
    return out;
  }, [selectedProducts, copiesPerProduct]);

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="طباعة ملصقات الباركود"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden print-only-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar */}
        <div className="no-print shrink-0 px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>رجوع</span>
            </button>
            <Barcode className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              طباعة باركود الأصناف ({labels.length} ملصق)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={labels.length === 0}
              onClick={() => window.print()}
              className="btn-sheen px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الملصقات</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls Panel (Hidden on print) */}
        <div className="no-print shrink-0 p-4 bg-sky-50/70 border-b border-sky-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">عدد النسخ لكل صنف:</span>
                <button
                  type="button"
                  onClick={() => setCopiesPerProduct((c) => Math.max(1, c - 1))}
                  className="w-7 h-7 rounded-lg border border-sky-300 bg-white flex items-center justify-center hover:bg-sky-100"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono-num font-bold text-sm w-6 text-center">
                  {copiesPerProduct}
                </span>
                <button
                  type="button"
                  onClick={() => setCopiesPerProduct((c) => Math.min(30, c + 1))}
                  className="w-7 h-7 rounded-lg border border-sky-300 bg-white flex items-center justify-center hover:bg-sky-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-700"
                />
                <span>إظهار السعر على الملصق</span>
              </label>

              {includePrice && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeVatPrice}
                    onChange={(e) => setIncludeVatPrice(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-700"
                  />
                  <span>شامل ضريبة {vatRate}%</span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedIds(products.map((p) => p.id))}
                className="font-bold text-blue-700 hover:underline"
              >
                تحديد كل الأصناف
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="font-bold text-slate-600 hover:underline"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {products.map((p) => {
              const checked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                    checked
                      ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {p.name_ar}
                </button>
              );
            })}
          </div>
        </div>

        {/* Printable Barcode Labels Sheet */}
        <div className="flex-1 overflow-y-auto p-5 bg-white">
          {labels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              اختر صنفاً واحداً على الأقل لمعاينة وطباعة ملصقات الباركود.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2">
              {labels.map(({ key, product }) => {
                const code = product.barcode || product.sku;
                const { text, bars, totalWidth } = generateCode39Bars(code);
                const shownPrice = includeVatPrice
                  ? calculatePriceWithVat(product.selling_price, vatRate)
                  : product.selling_price;
                return (
                  <div
                    key={key}
                    className="border border-slate-300 rounded-lg p-2.5 bg-white text-center flex flex-col items-center justify-between gap-1 break-inside-avoid"
                  >
                    <div className="text-[9px] font-bold text-slate-500 truncate w-full">
                      {businessName}
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2 w-full">
                      {product.name_ar}
                    </div>
                    <div className="w-full px-1 py-0.5 flex justify-center">
                      <svg
                        viewBox={`0 0 ${totalWidth} 38`}
                        className="w-full h-9 max-w-[170px]"
                        role="img"
                        aria-label={`باركود ${text}`}
                      >
                        {bars.map((b, idx) => (
                          <rect
                            key={idx}
                            x={b.x}
                            y={0}
                            width={b.width}
                            height={38}
                            fill="#0F172A"
                          />
                        ))}
                      </svg>
                    </div>
                    <div className="w-full flex items-center justify-between gap-1 text-[10px] font-mono-num">
                      <span className="text-slate-700 font-semibold">{text}</span>
                      {includePrice && (
                        <span className="font-bold text-blue-800">{formatEGP(shownPrice)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
