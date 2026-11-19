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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">سجل الفواتير والطباعة</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            فصل واضح بين فواتير خدمات الغسيل وفواتير بيع المنتجات مع تتبع الكاشير والفني.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            كل الفواتير ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('service')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              typeFilter === 'service'
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CarFront className="w-3.5 h-3.5" />
            <span>خدمات الغسيل</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('retail')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              typeFilter === 'retail'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>مبيعات المنتجات</span>
          </button>
        </div>
      </div>

      {/* Filter & Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة، اللوحة، العميل، أو اسم الموظف (مثل أحمد مجدي)..."
            className="w-full h-10 pr-10 pl-4 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-slate-500">عدد الفواتير: </span>
            <strong className="font-mono-num text-slate-900">{summary.count}</strong>
          </div>
          <div>
            <span className="text-slate-500">ضريبة 14%: </span>
            <strong className="font-mono-num text-slate-900">{formatEGP(summary.vat)}</strong>
          </div>
          <div>
            <span className="text-slate-500">الإجمالي: </span>
            <strong className="font-mono-num text-slate-900">{formatEGP(summary.total)}</strong>
          </div>
          <div>
            <span className="text-slate-500">صافي الربح: </span>
            <strong className="font-mono-num text-emerald-700">
              {formatEGP(summary.profit)}
            </strong>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-3 px-4 text-right font-semibold">رقم الفاتورة</th>
                <th className="py-3 px-4 text-right font-semibold">التصنيف</th>
                <th className="py-3 px-4 text-right font-semibold">العميل / التفاصيل</th>
                <th className="py-3 px-4 text-right font-semibold">المنفذ / البائع</th>
                <th className="py-3 px-4 text-right font-semibold">الكاشير</th>
                <th className="py-3 px-4 text-right font-semibold">الحالة</th>
                <th className="py-3 px-4 text-left font-semibold">الخصم</th>
                <th className="py-3 px-4 text-left font-semibold">ضريبة 14%</th>
                <th className="py-3 px-4 text-left font-semibold">الإجمالي</th>
                <th className="py-3 px-4 text-center font-semibold">طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-sm text-slate-500">
                    لا توجد فواتير مطابقة لمعايير البحث الحالية.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono-num font-bold text-slate-900">
                        {inv.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {formatDateTimeAr(inv.created_at)}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
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
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.customer_name}</div>
                      <div className="text-xs text-slate-500">
                        {inv.invoice_type === 'service'
                          ? `${inv.car_model || '—'} · ${inv.car_plate || '—'}`
                          : `${inv.items.length} صنف منتج`}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {getStaffName(inv.performed_by_staff_id)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {getStaffName(inv.created_by_staff_id)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inv.invoice_type === 'service' && inv.status !== 'completed' ? (
                        <select
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
                    <td className="py-3 px-4 text-left font-mono-num text-amber-700 whitespace-nowrap">
                      {inv.discount_amount > 0 ? `- ${formatEGP(inv.discount_amount)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-left font-mono-num text-slate-600 whitespace-nowrap">
                      {formatEGP(inv.vat_amount)}
                    </td>
                    <td className="py-3 px-4 text-left font-mono-num font-bold text-slate-900 whitespace-nowrap">
                      {formatEGP(inv.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onPreviewInvoice(inv)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
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
