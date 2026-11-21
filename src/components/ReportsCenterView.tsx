import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  FileSpreadsheet,
  Package,
  Printer,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Customer,
  Expense,
  Invoice,
  PartyPayment,
  PayrollPayout,
  Product,
  PurchaseOrder,
  StaffMember,
  Supplier,
  WalletAccount,
} from '../types/carwash';
import { exportToExcelXls } from '../utils/excelExport';
import { playSoundEffect } from '../utils/feedback';
import {
  EXPENSE_CATEGORY_LABELS,
  formatDateTimeAr,
  formatEGP,
  getPaymentMethodLabel,
  roundMoney,
  SALE_TIER_LABELS,
} from '../utils/pricing';

interface ReportsCenterViewProps {
  invoices: Invoice[];
  purchases: PurchaseOrder[];
  products: Product[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  partyPayments: PartyPayment[];
  staff: StaffMember[];
  payrollPayouts: PayrollPayout[];
  wallets: WalletAccount[];
  canViewProfits: boolean;
  canExportExcel: boolean;
}

type ReportTab =
  | 'pnl'
  | 'top_profit'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'expenses'
  | 'parties'
  | 'staff';

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({
  invoices,
  purchases,
  products,
  expenses,
  customers,
  suppliers,
  partyPayments,
  staff,
  payrollPayouts,
  wallets,
  canViewProfits,
  canExportExcel,
}) => {
  const [reportTab, setReportTab] = useState<ReportTab>(canViewProfits ? 'pnl' : 'sales');

  const validInvoices = useMemo(
    () => invoices.filter((i) => i.status !== 'cancelled'),
    [invoices]
  );

  // 1. P&L Calculation
  const pnl = useMemo(() => {
    const serviceRevNet = roundMoney(
      validInvoices
        .filter((i) => i.invoice_type === 'service')
        .reduce((s, i) => s + i.taxable_amount, 0)
    );
    const retailRevNet = roundMoney(
      validInvoices
        .filter((i) => i.invoice_type === 'retail')
        .reduce((s, i) => s + i.taxable_amount, 0)
    );
    const totalVat = roundMoney(validInvoices.reduce((s, i) => s + i.vat_amount, 0));
    const totalCogs = roundMoney(validInvoices.reduce((s, i) => s + i.total_cost, 0));
    const grossProfit = roundMoney(serviceRevNet + retailRevNet - totalCogs);
    const totalExpenses = roundMoney(expenses.reduce((s, e) => s + e.amount, 0));
    const totalPayroll = roundMoney(payrollPayouts.reduce((s, p) => s + p.net_paid, 0));
    const netProfit = roundMoney(grossProfit - totalExpenses - totalPayroll);

    return {
      serviceRevNet,
      retailRevNet,
      totalRevNet: roundMoney(serviceRevNet + retailRevNet),
      totalRevGross: roundMoney(validInvoices.reduce((s, i) => s + i.total_amount, 0)),
      totalVat,
      totalCogs,
      grossProfit,
      totalExpenses,
      totalPayroll,
      netProfit,
    };
  }, [validInvoices, expenses, payrollPayouts]);

  // 2. Top Profitable Products & Services Ranking
  const topProfitItems = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        itemType: 'product' | 'service';
        qtySold: number;
        revenueNet: number;
        costTotal: number;
        profitTotal: number;
      }
    >();

    validInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const key = it.product_id || it.service_id || it.item_name;
        const curr = map.get(key) || {
          key,
          name: it.item_name,
          itemType: it.item_type,
          qtySold: 0,
          revenueNet: 0,
          costTotal: 0,
          profitTotal: 0,
        };
        const rev = it.line_total;
        const cost = it.unit_cost * it.quantity;
        curr.qtySold += it.quantity;
        curr.revenueNet = roundMoney(curr.revenueNet + rev);
        curr.costTotal = roundMoney(curr.costTotal + cost);
        curr.profitTotal = roundMoney(curr.profitTotal + (rev - cost));
        map.set(key, curr);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.profitTotal - a.profitTotal);
  }, [validInvoices]);

  const topProfitProductOnly = useMemo(
    () => topProfitItems.filter((item) => item.itemType === 'product')[0] || topProfitItems[0] || null,
    [topProfitItems]
  );

  // 3. Party Balances
  const partyBalances = useMemo(() => {
    const custList = customers.map((c) => {
      const def = validInvoices
        .filter((i) => i.customer_id === c.id && i.payment_method === 'deferred')
        .reduce((s, i) => s + i.total_amount, 0);
      const col = partyPayments
        .filter((p) => p.party_type === 'customer' && p.party_id === c.id)
        .reduce((s, p) => s + p.amount, 0);
      return {
        type: 'عميل' as const,
        name: c.full_name,
        phone: c.phone,
        balance: roundMoney((c.opening_balance || 0) + def - col),
      };
    });

    const supList = suppliers.map((sup) => {
      const def = purchases
        .filter((p) => p.supplier_id === sup.id)
        .reduce((s, p) => s + Math.max(0, p.total_amount - p.paid_amount), 0);
      const paid = partyPayments
        .filter((p) => p.party_type === 'supplier' && p.party_id === sup.id)
        .reduce((s, p) => s + p.amount, 0);
      return {
        type: 'مورد' as const,
        name: sup.name,
        phone: sup.phone,
        balance: roundMoney((sup.opening_balance || 0) + def - paid),
      };
    });

    return [...custList, ...supList];
  }, [customers, suppliers, validInvoices, purchases, partyPayments]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock_qty <= p.min_stock_alert),
    [products]
  );

  const handleExportCurrent = () => {
    playSoundEffect('click');
    if (reportTab === 'top_profit') {
      exportToExcelXls({
        filename: 'perfect_top_profitable_items',
        sheetTitle: 'تقرير المنتجات والخدمات الأعلى ربحاً',
        columns: [
          { header: 'الصنف / الخدمة', value: (r) => r.name },
          { header: 'النوع', value: (r) => (r.itemType === 'product' ? 'منتج' : 'خدمة غسيل') },
          { header: 'الكمية المباعة', value: (r) => r.qtySold },
          { header: 'صافي المبيعات', value: (r) => r.revenueNet },
          { header: 'التكلفة', value: (r) => r.costTotal },
          { header: 'صافي الربح', value: (r) => r.profitTotal },
        ],
        rows: topProfitItems,
      });
    } else if (reportTab === 'sales') {
      exportToExcelXls({
        filename: 'perfect_sales_report',
        sheetTitle: 'تقرير المبيعات التفصيلي',
        columns: [
          { header: 'رقم الفاتورة', value: (r) => r.invoice_number },
          { header: 'التاريخ', value: (r) => formatDateTimeAr(r.created_at) },
          { header: 'النوع', value: (r) => (r.invoice_type === 'service' ? 'غسيل' : 'منتجات') },
          { header: 'فئة البيع', value: (r) => SALE_TIER_LABELS[r.sale_tier || 'retail'] },
          { header: 'الدفع', value: (r) => getPaymentMethodLabel(r.payment_method, wallets) },
          { header: 'العميل', value: (r) => r.customer_name },
          { header: 'الإجمالي', value: (r) => r.total_amount },
          { header: 'الربح', value: (r) => r.net_profit },
        ],
        rows: validInvoices,
      });
    } else if (reportTab === 'purchases') {
      exportToExcelXls({
        filename: 'perfect_purchases_report',
        sheetTitle: 'تقرير المشتريات',
        columns: [
          { header: 'رقم المشتريات', value: (r) => r.purchase_number },
          { header: 'المورد', value: (r) => r.supplier_name },
          { header: 'التاريخ', value: (r) => formatDateTimeAr(r.created_at) },
          { header: 'الإجمالي', value: (r) => r.total_amount },
          { header: 'المدفوع', value: (r) => r.paid_amount },
        ],
        rows: purchases,
      });
    } else if (reportTab === 'inventory') {
      exportToExcelXls({
        filename: 'perfect_inventory_shortages',
        sheetTitle: 'تقرير المخزن والنواقص',
        columns: [
          { header: 'SKU', value: (r) => r.sku },
          { header: 'المنتج', value: (r) => r.name_ar },
          { header: 'الرصيد', value: (r) => r.stock_qty },
          { header: 'حد التنبيه', value: (r) => r.min_stock_alert },
          { header: 'التكلفة', value: (r) => r.cost_price },
          { header: 'قطاعي', value: (r) => r.selling_price },
        ],
        rows: products,
      });
    } else if (reportTab === 'expenses') {
      exportToExcelXls({
        filename: 'perfect_expenses_report',
        sheetTitle: 'تقرير المصروفات النثرية',
        columns: [
          { header: 'الرقم', value: (r) => r.expense_number },
          { header: 'التصنيف', value: (r) => EXPENSE_CATEGORY_LABELS[r.category] },
          { header: 'البيان', value: (r) => r.title },
          { header: 'المبلغ', value: (r) => r.amount },
        ],
        rows: expenses,
      });
    } else if (reportTab === 'parties') {
      exportToExcelXls({
        filename: 'perfect_parties_balances',
        sheetTitle: 'تقرير أرصدة العملاء والموردين',
        columns: [
          { header: 'النوع', value: (r) => r.type },
          { header: 'الاسم', value: (r) => r.name },
          { header: 'الهاتف', value: (r) => r.phone },
          { header: 'الرصيد', value: (r) => r.balance },
        ],
        rows: partyBalances,
      });
    } else {
      exportToExcelXls({
        filename: 'perfect_pnl_summary',
        sheetTitle: 'تقرير الأرباح والخسائر',
        columns: [
          { header: 'البند', value: (r) => r.label },
          { header: 'القيمة', value: (r) => r.amount },
        ],
        rows: [
          { label: 'إيرادات خدمات الغسيل (قبل الضريبة)', amount: pnl.serviceRevNet },
          { label: 'إيرادات مبيعات المنتجات (قبل الضريبة)', amount: pnl.retailRevNet },
          { label: 'تكلفة المبيعات والخدمات (COGS)', amount: -pnl.totalCogs },
          { label: 'مجمل الربح', amount: pnl.grossProfit },
          { label: 'المصروفات النثرية والتشغيلية', amount: -pnl.totalExpenses },
          { label: 'الرواتب والأجور المنصرفة', amount: -pnl.totalPayroll },
          { label: 'صافي الربح النهائي', amount: pnl.netProfit },
        ],
      });
    }
  };

  const tabs: Array<{
    id: ReportTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hidden?: boolean;
  }> = [
    { id: 'pnl', label: 'أرباح وخسائر (P&L)', icon: TrendingUp, hidden: !canViewProfits },
    { id: 'top_profit', label: 'الأعلى ربحاً', icon: Award, hidden: !canViewProfits },
    { id: 'sales', label: 'تقارير المبيعات', icon: BarChart3 },
    { id: 'purchases', label: 'تقارير المشتريات', icon: ShoppingBag },
    { id: 'inventory', label: 'المخزن والنواقص', icon: Package },
    { id: 'expenses', label: 'المصروفات النثرية', icon: Wallet },
    { id: 'parties', label: 'العملاء والموردين', icon: Users },
    { id: 'staff', label: 'الموظفين والمرتبات', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Tabs */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              مركز التقارير الشاملة والأرباح والخسائر
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              تقارير شاملة لكل أجزاء البرنامج: أرباح وخسائر، أعلى المنتجات ربحية، مبيعات، مشتريات، نواقص المخزن، ومرتبات.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExportExcel && (
              <button
                type="button"
                onClick={handleExportCurrent}
                className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير إكسيل</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => {
              const Icon = t.icon;
              const active = reportTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    playSoundEffect('click');
                    setReportTab(t.id);
                  }}
                  className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
                    active
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Report 1: P&L */}
      {reportTab === 'pnl' && canViewProfits && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-blue-800">صافي الإيرادات (قبل الضريبة)</div>
              <div className="text-lg font-bold font-mono-num text-slate-900 mt-1">
                {formatEGP(pnl.totalRevNet)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                غسيل: {formatEGP(pnl.serviceRevNet)} · منتجات: {formatEGP(pnl.retailRevNet)}
              </div>
            </div>
            <div className="bg-stone-100 border border-stone-300 rounded-2xl p-4">
              <div className="text-xs font-semibold text-stone-800">تكلفة المبيعات والخدمات</div>
              <div className="text-lg font-bold font-mono-num text-slate-900 mt-1">
                {formatEGP(pnl.totalCogs)}
              </div>
              <div className="text-[11px] text-stone-600 mt-1">
                مجمل الربح: <strong className="font-mono-num">{formatEGP(pnl.grossProfit)}</strong>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-orange-900">المصروفات والرواتب</div>
              <div className="text-lg font-bold font-mono-num text-red-700 mt-1">
                {formatEGP(pnl.totalExpenses + pnl.totalPayroll)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                نثريات: {formatEGP(pnl.totalExpenses)} · رواتب: {formatEGP(pnl.totalPayroll)}
              </div>
            </div>
            <div
              className={`border rounded-2xl p-4 ${
                pnl.netProfit >= 0
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-800">صافي الربح النهائي (بعد المصروفات)</div>
              <div
                className={`text-xl font-bold font-mono-num mt-1 ${
                  pnl.netProfit >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                {formatEGP(pnl.netProfit)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                ضريبة 14% محصلة: <strong className="font-mono-num">{formatEGP(pnl.totalVat)}</strong>
              </div>
            </div>
          </div>

          {topProfitProductOnly && (
            <div className="bg-amber-50/85 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    المنتج الأعلى ربحاً في المغسلة حالياً
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {topProfitProductOnly.name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-600">الكمية المباعة: </span>
                  <strong className="font-mono-num">{topProfitProductOnly.qtySold}</strong>
                </div>
                <div>
                  <span className="text-slate-600">صافي الربح المحقق: </span>
                  <strong className="font-mono-num text-emerald-700 text-sm">
                    {formatEGP(topProfitProductOnly.profitTotal)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">قائمة الدخل (الأرباح والخسائر)</h3>
            <div className="divide-y divide-slate-200 text-xs">
              <div className="py-2.5 flex justify-between">
                <span>إيرادات خدمات الغسيل والعناية (صافي قبل الضريبة)</span>
                <strong className="font-mono-num">{formatEGP(pnl.serviceRevNet)}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span>إيرادات مبيعات المنتجات المنفردة (صافي قبل الضريبة)</span>
                <strong className="font-mono-num">{formatEGP(pnl.retailRevNet)}</strong>
              </div>
              <div className="py-2.5 flex justify-between text-red-700">
                <span>(-) تكلفة البضاعة المباعة وتكلفة التشغيل المباشر</span>
                <strong className="font-mono-num">- {formatEGP(pnl.totalCogs)}</strong>
              </div>
              <div className="py-2.5 flex justify-between bg-slate-50 px-2 font-bold">
                <span>(=) مجمل الربح الإجمالي</span>
                <strong className="font-mono-num text-blue-800">{formatEGP(pnl.grossProfit)}</strong>
              </div>
              <div className="py-2.5 flex justify-between text-red-700">
                <span>(-) إجمالي المصروفات النثرية والتشغيلية</span>
                <strong className="font-mono-num">- {formatEGP(pnl.totalExpenses)}</strong>
              </div>
              <div className="py-2.5 flex justify-between text-red-700">
                <span>(-) إجمالي المرتبات والعمولات المصروفة</span>
                <strong className="font-mono-num">- {formatEGP(pnl.totalPayroll)}</strong>
              </div>
              <div className="py-3 flex justify-between bg-emerald-50 px-3 rounded-lg font-bold text-sm text-emerald-900 mt-1">
                <span>(=) صافي الربح (أو الخسارة) النهائي</span>
                <strong className="font-mono-num">{formatEGP(pnl.netProfit)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Top Profitable Products & Services */}
      {reportTab === 'top_profit' && canViewProfits && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              المنتجات والخدمات الأعلى ربحاً (مرتبة تنازلياً حسب صافي الربح)
            </h3>
          </div>
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">الترتيب</th>
                  <th className="py-2.5 px-3 text-right">الصنف / الخدمة</th>
                  <th className="py-2.5 px-3 text-right">النوع</th>
                  <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                  <th className="py-2.5 px-3 text-left">صافي المبيعات</th>
                  <th className="py-2.5 px-3 text-left">التكلفة</th>
                  <th className="py-2.5 px-3 text-left">صافي الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {topProfitItems.map((it, idx) => (
                  <tr key={it.key} className={idx === 0 ? 'bg-amber-50/50' : ''}>
                    <td className="py-2.5 px-3 font-mono-num font-bold">#{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{it.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {it.itemType === 'product' ? 'منتج مخزن' : 'خدمة غسيل'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono-num font-bold">{it.qtySold}</td>
                    <td className="py-2.5 px-3 text-left font-mono-num">{formatEGP(it.revenueNet)}</td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-slate-600">
                      {formatEGP(it.costTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num font-bold text-emerald-700">
                      {formatEGP(it.profitTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Sales */}
      {reportTab === 'sales' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">الفاتورة</th>
                  <th className="py-2.5 px-3 text-right">النوع والفئة</th>
                  <th className="py-2.5 px-3 text-right">العميل</th>
                  <th className="py-2.5 px-3 text-right">طريقة الدفع</th>
                  <th className="py-2.5 px-3 text-left">الضريبة</th>
                  <th className="py-2.5 px-3 text-left">الإجمالي</th>
                  {canViewProfits && <th className="py-2.5 px-3 text-left">الربح</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {validInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 px-3 font-mono-num font-bold">{inv.invoice_number}</td>
                    <td className="py-2.5 px-3">
                      {inv.invoice_type === 'service' ? 'غسيل' : 'منتجات'} ·{' '}
                      {SALE_TIER_LABELS[inv.sale_tier || 'retail']}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{inv.customer_name}</td>
                    <td className="py-2.5 px-3">
                      {getPaymentMethodLabel(inv.payment_method, wallets)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num">
                      {formatEGP(inv.vat_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num font-bold">
                      {formatEGP(inv.total_amount)}
                    </td>
                    {canViewProfits && (
                      <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700 font-bold">
                        {formatEGP(inv.net_profit)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 4: Purchases */}
      {reportTab === 'purchases' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">رقم الفاتورة</th>
                  <th className="py-2.5 px-3 text-right">المورد</th>
                  <th className="py-2.5 px-3 text-right">الدفع</th>
                  <th className="py-2.5 px-3 text-left">الإجمالي</th>
                  <th className="py-2.5 px-3 text-left">المدفوع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-mono-num font-bold">{p.purchase_number}</td>
                    <td className="py-2.5 px-3 font-semibold">{p.supplier_name}</td>
                    <td className="py-2.5 px-3">
                      {getPaymentMethodLabel(p.payment_method, wallets)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num font-bold">
                      {formatEGP(p.total_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700">
                      {formatEGP(p.paid_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 5: Inventory & Shortages */}
      {reportTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-xs font-bold text-orange-900">
            عدد الأصناف التي وصلت لحد النقص (النواقص):{' '}
            <span className="font-mono-num text-red-700">{lowStockProducts.length} صنف</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[440px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 text-right">الصنف</th>
                    <th className="py-2.5 px-3 text-right">المخزن</th>
                    <th className="py-2.5 px-3 text-center">الرصيد الحالي</th>
                    <th className="py-2.5 px-3 text-center">حد التنبيه</th>
                    <th className="py-2.5 px-3 text-left">قطاعي</th>
                    <th className="py-2.5 px-3 text-left">نص جملة</th>
                    <th className="py-2.5 px-3 text-left">جملة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((p) => {
                    const isLow = p.stock_qty <= p.min_stock_alert;
                    return (
                      <tr key={p.id} className={isLow ? 'bg-red-50/50' : ''}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.name_ar}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {p.warehouse_name || 'المخزن الرئيسي'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-center font-mono-num font-bold ${
                            isLow ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {p.stock_qty} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-num">
                          {p.min_stock_alert}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num">
                          {formatEGP(p.selling_price)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num">
                          {formatEGP(p.half_wholesale_price || p.selling_price)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono-num">
                          {formatEGP(p.wholesale_price || p.selling_price)}
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

      {/* Report 6: Expenses */}
      {reportTab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">الرقم</th>
                  <th className="py-2.5 px-3 text-right">التصنيف</th>
                  <th className="py-2.5 px-3 text-right">البيان</th>
                  <th className="py-2.5 px-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 px-3 font-mono-num font-bold">{e.expense_number}</td>
                    <td className="py-2.5 px-3">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                    <td className="py-2.5 px-3 font-semibold">{e.title}</td>
                    <td className="py-2.5 px-3 text-left font-mono-num font-bold text-red-700">
                      {formatEGP(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 7: Customers & Suppliers */}
      {reportTab === 'parties' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">النوع</th>
                  <th className="py-2.5 px-3 text-right">الاسم</th>
                  <th className="py-2.5 px-3 text-right">الهاتف</th>
                  <th className="py-2.5 px-3 text-left">الرصيد المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {partyBalances.map((p, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3 font-bold">{p.type}</td>
                    <td className="py-2.5 px-3 font-semibold">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono-num">{p.phone}</td>
                    <td
                      className={`py-2.5 px-3 text-left font-mono-num font-bold ${
                        p.balance > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatEGP(p.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 8: Staff & Payroll */}
      {reportTab === 'staff' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-right">الموظف</th>
                  <th className="py-2.5 px-3 text-right">الدور</th>
                  <th className="py-2.5 px-3 text-left">الراتب الأساسي</th>
                  <th className="py-2.5 px-3 text-center">العمولة %</th>
                  <th className="py-2.5 px-3 text-left">إجمالي مصروف الرواتب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staff.map((m) => {
                  const paidSum = payrollPayouts
                    .filter((p) => p.staff_id === m.id)
                    .reduce((s, p) => s + p.net_paid, 0);
                  return (
                    <tr key={m.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{m.full_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{m.role_title_ar}</td>
                      <td className="py-2.5 px-3 text-left font-mono-num">
                        {formatEGP(m.base_salary)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-num">{m.commission_rate}%</td>
                      <td className="py-2.5 px-3 text-left font-mono-num font-bold text-emerald-700">
                        {formatEGP(paidSum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
