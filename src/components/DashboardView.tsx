import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CarFront,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Plus,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Invoice, InvoiceStatus, Product, StaffMember } from '../types/carwash';
import { playSoundEffect } from '../utils/feedback';
import {
  formatDateTimeAr,
  formatEGP,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../utils/pricing';

interface DashboardViewProps {
  invoices: Invoice[];
  products: Product[];
  staff: StaffMember[];
  onOpenPos: (mode: 'service' | 'retail') => void;
  onUpdateStatus: (invoiceId: string, status: InvoiceStatus) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onNavigateTab: (tab: 'inventory' | 'invoices' | 'staff') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  products,
  staff,
  onOpenPos,
  onUpdateStatus,
  onPreviewInvoice,
  onNavigateTab,
}) => {
  const stats = useMemo(() => {
    const active = invoices.filter((i) => i.status !== 'cancelled');
    const serviceInvs = active.filter((i) => i.invoice_type === 'service');
    const retailInvs = active.filter((i) => i.invoice_type === 'retail');

    const serviceRevenue = serviceInvs.reduce((s, i) => s + i.total_amount, 0);
    const retailRevenue = retailInvs.reduce((s, i) => s + i.total_amount, 0);
    const totalVat = active.reduce((s, i) => s + i.vat_amount, 0);
    const totalProfit = active.reduce((s, i) => s + i.net_profit, 0);

    return {
      totalRevenue: serviceRevenue + retailRevenue,
      serviceRevenue,
      serviceCount: serviceInvs.length,
      retailRevenue,
      retailCount: retailInvs.length,
      totalVat,
      totalProfit,
    };
  }, [invoices]);

  const activeWashQueue = useMemo(
    () =>
      invoices.filter(
        (i) =>
          i.invoice_type === 'service' &&
          (i.status === 'pending' || i.status === 'washing' || i.status === 'ready')
      ),
    [invoices]
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock_qty <= p.min_stock_alert),
    [products]
  );

  const getStaffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.full_name || '—';

  const getNextStatus = (
    status: InvoiceStatus
  ): { next: InvoiceStatus; label: string } | null => {
    if (status === 'pending') return { next: 'washing', label: 'بدء الغسيل' };
    if (status === 'washing') return { next: 'ready', label: 'جاهزة للتسليم' };
    if (status === 'ready') return { next: 'completed', label: 'تسليم وإغلاق' };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Strip */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">مركز عمليات المغسلة والمبيعات</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            متابعة حارات الغسيل النشطة، الفصل الفوري بين فواتير الخدمات ومبيعات المنتجات، وحساب ضريبة 14%.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              playSoundEffect('click');
              onOpenPos('service');
            }}
            className="group btn-sheen px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
            <span>فاتورة غسيل سيارة</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playSoundEffect('click');
              onOpenPos('retail');
            }}
            className="group btn-sheen px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Package className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span>فاتورة بيع منتج</span>
          </button>
        </div>
      </div>

      {/* 4-Column Soft-Tinted KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Warm Stone / Light Brown Tint */}
        <div className="bg-stone-100/90 border border-stone-300/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-stone-700 font-semibold mb-2">
            <span>إجمالي الإيرادات (شامل 14%)</span>
            <div className="w-7 h-7 rounded-lg bg-stone-200/80 text-stone-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.totalRevenue)}
          </div>
          <div className="text-[11px] text-stone-700 mt-1.5">
            صافي الربح التقديري:{' '}
            <span className="font-mono-num font-bold text-emerald-700">
              {formatEGP(stats.totalProfit)}
            </span>
          </div>
        </div>

        {/* Light Sky Blue Tint */}
        <div className="bg-sky-50/90 border border-sky-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-blue-800 font-semibold mb-2">
            <span>إيرادات خدمات الغسيل</span>
            <div className="w-7 h-7 rounded-lg bg-sky-100 text-blue-700 flex items-center justify-center">
              <CarFront className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.serviceRevenue)}
          </div>
          <div className="text-[11px] text-blue-900/75 mt-1.5">
            عدد فواتير الخدمات: <span className="font-mono-num font-bold">{stats.serviceCount}</span> فاتورة
          </div>
        </div>

        {/* Light Mint Green Tint */}
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-2">
            <span>مبيعات المنتجات المنفردة</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.retailRevenue)}
          </div>
          <div className="text-[11px] text-emerald-900/75 mt-1.5">
            عدد فواتير البيع: <span className="font-mono-num font-bold">{stats.retailCount}</span> فاتورة
          </div>
        </div>

        {/* Light Salmon / Peach Tint */}
        <div className="bg-orange-50/85 border border-orange-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-orange-900 font-semibold mb-2">
            <span>ضريبة القيمة المضافة (14%)</span>
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.totalVat)}
          </div>
          <div className="text-[11px] text-orange-900/75 mt-1.5">
            مستحقة عن كافة الفواتير المعتمدة
          </div>
        </div>
      </div>

      {/* Main Split: Active Wash Bays + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Wash Queue */}
        <div className="lg:col-span-8 bg-sky-50/55 border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-sky-100/70 border-b border-sky-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                سيارات في المغسلة حالياً ({activeWashQueue.length})
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                متابعة حالة كل سيارة والمسؤول عن التنفيذ في الحارة
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="group text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors"
            >
              <span>كل الفواتير</span>
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>

          {activeWashQueue.length === 0 ? (
            <div className="p-8 text-center bg-white/70">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                لا توجد سيارات قيد الغسيل حالياً
              </p>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك فتح فاتورة غسيل جديدة لبدء تشغيل أي حارة.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-sky-200/80 bg-white/80">
              {activeWashQueue.map((inv) => {
                const action = getNextStatus(inv.status);
                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-sky-50/75 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900">
                          {inv.car_model || 'سيارة'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono-num text-xs font-semibold text-blue-900 bg-sky-100/80 border border-sky-200 px-2 py-0.5 rounded-md">
                          {inv.car_plate || 'بدون لوحة'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-600 font-medium">{inv.wash_bay}</span>
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span>العميل: {inv.customer_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          الفني المسؤول:{' '}
                          <strong className="text-slate-900">
                            {getStaffName(inv.performed_by_staff_id)}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-slate-500">{inv.invoice_number}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                          inv.status === 'ready'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : inv.status === 'washing'
                            ? 'bg-sky-100 text-blue-800 border-blue-200'
                            : 'bg-orange-50 text-orange-800 border-orange-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{INVOICE_STATUS_LABELS[inv.status]}</span>
                      </span>

                      {action && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(inv.id, action.next)}
                          className="group btn-sheen px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                          <span>{action.label}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onPreviewInvoice(inv)}
                        className="group px-3 py-1.5 rounded-lg border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-blue-700 text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        <span>الفاتورة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alert Panel (Light Salmon / Peach Tint) */}
        <div className="lg:col-span-4 bg-orange-50/70 border border-orange-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-orange-100/75 border-b border-orange-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-700" />
              <h3 className="text-base font-bold text-slate-900">
                تنبيهات نقص المخزن ({lowStockProducts.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="group text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors"
            >
              <span>إدارة المخزن</span>
              <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-600 bg-white/75">
              جميع أصناف المخزن متوفرة بكميات آمنة.
            </div>
          ) : (
            <div className="divide-y divide-orange-200/80 bg-white/80">
              {lowStockProducts.map((prod) => (
                <div key={prod.id} className="p-4 flex items-center justify-between gap-3 hover:bg-orange-50/70 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{prod.name_ar}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono-num">
                      {prod.sku} · الحد الأدنى: {prod.min_stock_alert}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-sm font-bold font-mono-num text-red-600">
                      {prod.stock_qty} {prod.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices Table (Light Warm Stone Header + Crisp Container Shadow) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-stone-100/80 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">أحدث الفواتير الصادرة</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              توثيق كامل للمسؤول عن التنفيذ والكاشير وضريبة 14%
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('invoices')}
            className="group text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors"
          >
            <span>فتح السجل الكامل</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
              <tr>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">رقم الفاتورة</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">النوع</th>
                <th className="py-2.5 px-3 text-right font-semibold min-w-[190px] whitespace-nowrap">العميل / السيارة</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">المنفذ / البائع</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الكاشير</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الدفع</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">ضريبة 14%</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">الإجمالي</th>
                <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.slice(0, 6).map((inv) => (
                <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                    {inv.invoice_number}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`text-xs font-bold ${
                        inv.invoice_type === 'service' ? 'text-blue-700' : 'text-emerald-700'
                      }`}
                    >
                      {inv.invoice_type === 'service' ? 'خدمة غسيل' : 'بيع منتج'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 min-w-[190px]">
                    <div className="font-semibold text-slate-900 whitespace-nowrap">{inv.customer_name}</div>
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                      {inv.invoice_type === 'service'
                        ? `${inv.car_model || ''} · ${inv.car_plate || ''}`
                        : formatDateTimeAr(inv.created_at)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {getStaffName(inv.performed_by_staff_id)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {getStaffName(inv.created_by_staff_id)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                    {PAYMENT_METHOD_LABELS[inv.payment_method]}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono-num text-slate-600 whitespace-nowrap">
                    {formatEGP(inv.vat_amount)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono-num font-bold text-slate-900 whitespace-nowrap">
                    {formatEGP(inv.total_amount)}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onPreviewInvoice(inv)}
                      className="group px-2.5 py-1 rounded-lg border border-blue-200 bg-sky-50/70 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-blue-700 text-xs font-semibold transition-all inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                      <span>عرض وطباعة</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
