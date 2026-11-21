import React, { useEffect } from 'react';
import { ArrowRight, CarFront, Package, Printer, X } from 'lucide-react';
import { AppSettings, Invoice, StaffMember, WalletAccount } from '../types/carwash';
import { BrandLogo } from './BrandLogo';
import {
  formatDateTimeAr,
  formatEGP,
  getPaymentMethodLabel,
  INVOICE_STATUS_LABELS,
  SALE_TIER_LABELS,
  VEHICLE_TIER_LABELS,
} from '../utils/pricing';

interface InvoicePrintModalProps {
  invoice: Invoice;
  settings: AppSettings;
  staff: StaffMember[];
  wallets: WalletAccount[];
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  settings,
  staff,
  wallets,
  onClose,
}) => {
  const isService = invoice.invoice_type === 'service';
  const getStaffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.full_name || 'غير محدد';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة وطباعة الفاتورة"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden print-only-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Top Action Bar (Always reachable, hidden when printing) */}
        <div className="no-print shrink-0 px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>رجوع</span>
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              {isService ? (
                <CarFront className="w-4 h-4 text-blue-700 shrink-0" />
              ) : (
                <Package className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {isService
                  ? 'معاينة فاتورة خدمات الغسيل'
                  : 'معاينة فاتورة مبيعات المنتجات'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isService
                  ? 'bg-blue-700 hover:bg-blue-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المعاينة"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white text-slate-900 space-y-5">
          {/* Header Banner */}
          <div
            className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isService
                ? 'bg-blue-50/70 border-blue-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <BrandLogo size="md" />
              <div>
                <p
                  className={`text-xs font-bold mb-0.5 ${
                    isService ? 'text-blue-700' : 'text-emerald-700'
                  }`}
                >
                  {isService
                    ? 'فاتورة خدمات غسيل وعناية بالسيارات'
                    : `فاتورة مبيعات منتجات (${SALE_TIER_LABELS[invoice.sale_tier || 'retail']})`}
                </p>
                <h2 className="text-lg font-bold text-slate-900">{settings.business_name}</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {settings.address || settings.branch_name} · السجل الضريبي:{' '}
                  <span className="font-mono-num">{settings.tax_registration_no}</span>
                </p>
              </div>
            </div>
            <div className="text-right sm:text-left">
              <div className="text-[11px] text-slate-500">رقم الفاتورة</div>
              <div className="text-base font-bold font-mono-num text-slate-900">
                {invoice.invoice_number}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {formatDateTimeAr(invoice.created_at)}
              </div>
            </div>
          </div>

          {/* Context Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">بيانات العميل</div>
              <div className="font-bold text-slate-900 text-sm">{invoice.customer_name}</div>
              {invoice.customer_phone && (
                <div className="text-slate-600 font-mono-num">
                  هاتف: {invoice.customer_phone}
                </div>
              )}
              <div className="text-slate-600">
                الدفع: {getPaymentMethodLabel(invoice.payment_method, wallets)} · الحالة:{' '}
                {INVOICE_STATUS_LABELS[invoice.status]}
              </div>
            </div>

            {isService ? (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-blue-700">
                  بيانات السيارة والتشغيل
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {invoice.car_model || 'سيارة'} · لوحة:{' '}
                  <span className="font-mono-num">{invoice.car_plate || '—'}</span>
                </div>
                <div className="text-slate-600">
                  الفئة: {invoice.vehicle_tier ? VEHICLE_TIER_LABELS[invoice.vehicle_tier] : '—'}{' '}
                  · {invoice.wash_bay || 'حارة الغسيل 1'}
                </div>
                <div className="text-slate-700">
                  القائم بالغسيل: <strong>{getStaffName(invoice.performed_by_staff_id)}</strong> ·
                  الكاشير: <strong>{getStaffName(invoice.created_by_staff_id)}</strong>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-emerald-700">
                  تفاصيل البيع المنفرد والمخزن
                </div>
                <div className="text-slate-700">
                  مسؤول البيع / المخزن:{' '}
                  <strong>{getStaffName(invoice.performed_by_staff_id)}</strong>
                </div>
                <div className="text-slate-700">
                  مُصدر الفاتورة (الكاشير):{' '}
                  <strong>{getStaffName(invoice.created_by_staff_id)}</strong>
                </div>
                <div className="text-slate-500">
                  نوع العملية: بيع منتجات مباشرة (بدون خدمة غسيل)
                </div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 px-3 text-right font-semibold">#</th>
                  <th className="py-2 px-3 text-right font-semibold">
                    {isService ? 'الخدمة المقدمة' : 'المنتج / الصنف'}
                  </th>
                  <th className="py-2 px-3 text-center font-semibold">الكمية</th>
                  <th className="py-2 px-3 text-left font-semibold">السعر</th>
                  <th className="py-2 px-3 text-left font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 text-slate-500 font-mono-num">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{item.item_name}</td>
                    <td className="py-2 px-3 text-center font-mono-num">{item.quantity}</td>
                    <td className="py-2 px-3 text-left font-mono-num text-slate-700">
                      {formatEGP(item.unit_price)}
                    </td>
                    <td className="py-2 px-3 text-left font-mono-num font-semibold text-slate-900">
                      {formatEGP(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & 14% Egypt VAT */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start">
            <div className="text-[11px] text-slate-500 space-y-1 max-w-xs">
              {invoice.notes && (
                <p className="text-slate-700">
                  <strong className="text-slate-900">ملاحظات:</strong> {invoice.notes}
                </p>
              )}
              <p>
                {isService ? settings.receipt_footer_service : settings.receipt_footer_retail}
              </p>
              <p className="text-slate-400">
                {settings.address} · <span className="font-mono-num">{settings.phone}</span>
              </p>
            </div>

            <div className="w-full sm:w-64 border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>المجموع قبل الضريبة</span>
                <span className="font-mono-num">{formatEGP(invoice.subtotal)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex items-center justify-between text-amber-700">
                  <span>
                    الخصم{' '}
                    {invoice.discount_type === 'percent' ? `(${invoice.discount_value}%)` : ''}
                  </span>
                  <span className="font-mono-num">- {formatEGP(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-600">
                <span>الصافي الخاضع للضريبة</span>
                <span className="font-mono-num">{formatEGP(invoice.taxable_amount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>ضريبة القيمة المضافة ({invoice.vat_rate}%)</span>
                <span className="font-mono-num">{formatEGP(invoice.vat_amount)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                <span>الإجمالي المستحق</span>
                <span className="font-mono-num">{formatEGP(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Bottom Footer (Extra clear Exit & Print actions) */}
        <div className="no-print shrink-0 px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>إغلاق والعودة للشاشة</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`px-5 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors ${
              isService
                ? 'bg-blue-700 hover:bg-blue-800'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الفاتورة الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
};
