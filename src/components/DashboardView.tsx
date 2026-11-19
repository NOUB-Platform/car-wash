import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CarFront,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Invoice, InvoiceStatus, Product, StaffMember } from '../types/carwash';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">مركز عمليات المغسلة والمبيعات</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            متابعة حارات الغسيل النشطة، الفصل الفوري بين فواتير الخدمات ومبيعات المنتجات، وحساب ضريبة 14%.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenPos('service')}
            className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>فاتورة غسيل سيارة</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPos('retail')}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Package className="w-3.5 h-3.5" />
            <span>فاتورة بيع منتج</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>إجمالي الإيرادات (شامل 14%)</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            صافي الربح التقديري:{' '}
            <span className="font-mono-num font-semibold text-emerald-700">
              {formatEGP(stats.totalProfit)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-blue-700 font-medium mb-1.5">
            <span>إيرادات خدمات الغسيل</span>
            <CarFront className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.serviceRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            عدد فواتير الخدمات: <span className="font-mono-num">{stats.serviceCount}</span> فاتورة
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-medium mb-1.5">
            <span>مبيعات المنتجات المنفردة</span>
            <Package className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.retailRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            عدد فواتير البيع: <span className="font-mono-num">{stats.retailCount}</span> فاتورة
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>ضريبة القيمة المضافة (14%)</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-num">
            {formatEGP(stats.totalVat)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            مستحقة عن كافة الفواتير المعتمدة
          </div>
        </div>
      </div>

      {/* Main Split: Active Wash Bays + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Wash Queue */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                سيارات في المغسلة حالياً ({activeWashQueue.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة حالة كل سيارة والمسؤول عن التنفيذ في الحارة
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
            >
              <span>كل الفواتير</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeWashQueue.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                لا توجد سيارات قيد الغسيل حالياً
              </p>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك فتح فاتورة غسيل جديدة لبدء تشغيل أي حارة.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {activeWashQueue.map((inv) => {
                const action = getNextStatus(inv.status);
                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900">
                          {inv.car_model || 'سيارة'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono-num text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {inv.car_plate || 'بدون لوحة'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{inv.wash_bay}</span>
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

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-md border ${
                          inv.status === 'ready'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.status === 'washing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{INVOICE_STATUS_LABELS[inv.status]}</span>
                      </span>

                      {action && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(inv.id, action.next)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          {action.label}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onPreviewInvoice(inv)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        الفاتورة
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alert Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">
                تنبيهات نقص المخزن ({lowStockProducts.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              إدارة المخزن
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              جميع أصناف المخزن متوفرة بكميات آمنة.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {lowStockProducts.map((prod) => (
                <div key={prod.id} className="p-4 flex items-center justify-between gap-3">
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

      {/* Recent Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">أحدث الفواتير الصادرة</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              توثيق كامل للمسؤول عن التنفيذ والكاشير وضريبة 14%
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('invoices')}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            فتح السجل الكامل
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
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                    {inv.invoice_number}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`text-xs font-semibold ${
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
                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700"
                    >
                      عرض وطباعة
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
