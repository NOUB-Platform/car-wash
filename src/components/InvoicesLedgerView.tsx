import React, { useMemo, useState } from 'react';
import { CarFront, Package, Printer, Search } from 'lucide-react';
import { Invoice, InvoiceStatus, InvoiceType, StaffMember } from '../types/carwash';
import {
  formatDateTimeAr,
  formatEGP,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../utils/pricing';

interface InvoicesLedgerViewProps {
  invoices: Invoice[];
  staff: StaffMember[];
  onPreviewInvoice: (invoice: Invoice) => void;
  onUpdateStatus: (invoiceId: string, status: InvoiceStatus) => void;
}

export const InvoicesLedgerView: React.FC<InvoicesLedgerViewProps> = ({
  invoices,
  staff,
  onPreviewInvoice,
  onUpdateStatus,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | InvoiceType>('all');
  const [search, setSearch] = useState('');

  const getStaffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.full_name || '—';

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== 'all' && inv.invoice_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const washer = getStaffName(inv.performed_by_staff_id).toLowerCase();
        const cashier = getStaffName(inv.created_by_staff_id).toLowerCase();
        const hit =
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.customer_name.toLowerCase().includes(q) ||
          (inv.car_plate || '').toLowerCase().includes(q) ||
          (inv.car_model || '').toLowerCase().includes(q) ||
          washer.includes(q) ||
          cashier.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [invoices, typeFilter, search, staff]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, inv) => {
        if (inv.status === 'cancelled') return acc;
        acc.count += 1;
        acc.vat += inv.vat_amount;
        acc.total += inv.total_amount;
        acc.profit += inv.net_profit;
        return acc;
      },
      { count: 0, vat: 0, total: 0, profit: 0 }
    );
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header & Unmistakable Folder-Tab Strip */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="pb-3">
          <h2 className="text-lg font-bold text-slate-900">سجل الفواتير والطباعة</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            فصل واضح بين فواتير خدمات الغسيل وفواتير بيع المنتجات مع تتبع الكاشير والفني.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="تصفية سجل الفواتير"
          className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'all'}
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-all whitespace-nowrap border border-b-0 ${
              typeFilter === 'all'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            كل الفواتير ({invoices.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'service'}
            onClick={() => setTypeFilter('service')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
              typeFilter === 'service'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <CarFront className="w-3.5 h-3.5" />
            <span>خدمات الغسيل</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'retail'}
            onClick={() => setTypeFilter('retail')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
              typeFilter === 'retail'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>مبيعات المنتجات</span>
          </button>
        </div>
      </div>

      {/* Filter & Summary Bar */}
      <div className="bg-stone-100/85 border border-stone-300/80 rounded-2xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="invoices-search"
            name="invoices-search"
            type="text"
            aria-label="بحث في سجل الفواتير"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة، اللوحة، العميل، أو اسم الموظف (مثل أحمد مجدي)..."
            className="w-full h-9 pr-10 pl-4 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs bg-white/80 px-3.5 py-2 rounded-xl border border-stone-200">
          <div>
            <span className="text-slate-600">عدد الفواتير: </span>
            <strong className="font-mono-num text-slate-900">{summary.count}</strong>
          </div>
          <div>
            <span className="text-slate-600">ضريبة 14%: </span>
            <strong className="font-mono-num text-slate-900">{formatEGP(summary.vat)}</strong>
          </div>
          <div>
            <span className="text-slate-600">الإجمالي: </span>
            <strong className="font-mono-num text-blue-800">{formatEGP(summary.total)}</strong>
          </div>
          <div>
            <span className="text-slate-600">صافي الربح: </span>
            <strong className="font-mono-num text-emerald-700">
              {formatEGP(summary.profit)}
            </strong>
          </div>
        </div>
      </div>

      {/* Ledger Table (Vertical + Horizontal Inner Scroll) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-315px)] min-h-[280px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">رقم الفاتورة</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">التصنيف</th>
                <th className="py-2.5 px-3 text-right font-semibold min-w-[200px] whitespace-nowrap">العميل / التفاصيل</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">المنفذ / البائع</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الكاشير</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الحالة</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">ضريبة 14%</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">الإجمالي</th>
                <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    لا توجد فواتير مطابقة لمعايير البحث الحالية.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono-num font-bold text-slate-900">
                        {inv.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {formatDateTimeAr(inv.created_at)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-bold ${
                          inv.invoice_type === 'service' ? 'text-blue-700' : 'text-emerald-700'
                        }`}
                      >
                        {inv.invoice_type === 'service' ? 'خدمات غسيل' : 'مبيعات منتجات'}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {PAYMENT_METHOD_LABELS[inv.payment_method]}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 min-w-[200px]">
                      <div className="font-semibold text-slate-900 whitespace-nowrap">
                        {inv.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">
                        {inv.invoice_type === 'service'
                          ? `${inv.car_model || '—'} · ${inv.car_plate || '—'}`
                          : `${inv.items.length} صنف منتج`}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {getStaffName(inv.performed_by_staff_id)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {getStaffName(inv.created_by_staff_id)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {inv.invoice_type === 'service' && inv.status !== 'completed' ? (
                        <select
                          id={`status-${inv.id}`}
                          name={`status-${inv.id}`}
                          aria-label={`تغيير حالة الفاتورة ${inv.invoice_number}`}
                          value={inv.status}
                          onChange={(e) =>
                            onUpdateStatus(inv.id, e.target.value as InvoiceStatus)
                          }
                          className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-800"
                        >
                          <option value="pending">في الانتظار</option>
                          <option value="washing">قيد التنفيذ</option>
                          <option value="ready">جاهزة للتسليم</option>
                          <option value="completed">مكتملة ومسلمة</option>
                          <option value="cancelled">ملغاة</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-slate-700">
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-slate-600 whitespace-nowrap">
                      {formatEGP(inv.vat_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {formatEGP(inv.total_amount)}
                      </div>
                      {inv.discount_amount > 0 && (
                        <div className="text-[10px] text-amber-700">
                          خصم: - {formatEGP(inv.discount_amount)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onPreviewInvoice(inv)}
                        className="group px-3 py-1.5 rounded-xl border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:border-blue-700 text-xs font-semibold text-blue-700 hover:text-white inline-flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Printer className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        <span>معاينة</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
