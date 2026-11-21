import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { CreatePurchasePayload } from '../store/useCarWashStore';
import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
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
} from '../utils/pricing';

interface PurchasesExpensesViewProps {
  purchases: PurchaseOrder[];
  expenses: Expense[];
  products: Product[];
  suppliers: Supplier[];
  wallets: WalletAccount[];
  activeStaff: StaffMember;
  canManagePurchases: boolean;
  canManageExpenses: boolean;
  canExportExcel: boolean;
  onCreatePurchase: (payload: CreatePurchasePayload) => Promise<PurchaseOrder>;
  onAddExpense: (params: {
    category: ExpenseCategory;
    title: string;
    amount: number;
    payment_method: PaymentMethod;
    staff_id: string;
    notes?: string;
  }) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

interface PurchaseCartRow {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

export const PurchasesExpensesView: React.FC<PurchasesExpensesViewProps> = ({
  purchases,
  expenses,
  products,
  suppliers,
  wallets,
  activeStaff,
  canManagePurchases,
  canManageExpenses,
  canExportExcel,
  onCreatePurchase,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [subTab, setSubTab] = useState<'purchases' | 'expenses'>(
    canManagePurchases ? 'purchases' : 'expenses'
  );

  // Purchase builder state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');
  const [purPayment, setPurPayment] = useState<PaymentMethod>('cash');
  const [purVat, setPurVat] = useState<number>(0);
  const [purNotes, setPurNotes] = useState<string>('');
  const [purSearch, setPurSearch] = useState<string>('');
  const [purCart, setPurCart] = useState<PurchaseCartRow[]>([]);
  const [submittingPur, setSubmittingPur] = useState(false);

  // Expense form state
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('hospitality');
  const [expTitle, setExpTitle] = useState<string>('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expPayment, setExpPayment] = useState<PaymentMethod>('cash');
  const [expNotes, setExpNotes] = useState<string>('');
  const [expFilterCat, setExpFilterCat] = useState<'all' | ExpenseCategory>('all');
  const [submittingExp, setSubmittingExp] = useState(false);

  const paymentOptions = useMemo(() => {
    const base: Array<{ value: PaymentMethod; label: string }> = [
      { value: 'cash', label: 'نقدي (من الدرج)' },
      { value: 'card', label: 'بطاقة بنكية / تحويل' },
      { value: 'deferred', label: 'آجل (على الحساب للمورد)' },
    ];
    wallets
      .filter((w) => w.is_active)
      .forEach((w) => {
        base.push({
          value: `wallet:${w.id}`,
          label: `${w.name} (${w.provider})`,
        });
      });
    return base;
  }, [wallets]);

  const filteredProducts = useMemo(() => {
    if (!purSearch.trim()) return products;
    const q = purSearch.trim().toLowerCase();
    return products.filter(
      (p) => p.name_ar.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, purSearch]);

  const purSubtotal = useMemo(
    () => roundMoney(purCart.reduce((s, r) => s + r.quantity * r.unit_cost, 0)),
    [purCart]
  );
  const purTotal = roundMoney(purSubtotal + (Number(purVat) || 0));

  const addProductToPurchase = (prod: Product) => {
    playSoundEffect('click');
    setPurCart((prev) => {
      const existing = prev.find((r) => r.product_id === prod.id);
      if (existing) {
        return prev.map((r) =>
          r.product_id === prod.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name_ar,
          quantity: 5,
          unit_cost: prod.cost_price,
        },
      ];
    });
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purCart.length === 0) return;
    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    const supName = sup?.name || customSupplierName.trim() || 'مورد عام';

    setSubmittingPur(true);
    try {
      await onCreatePurchase({
        supplier_id: sup?.id || null,
        supplier_name: supName,
        payment_method: purPayment,
        created_by_staff_id: activeStaff.id,
        vat_amount: Number(purVat) || 0,
        notes: purNotes.trim() || undefined,
        items: purCart,
      });
      setPurCart([]);
      setPurVat(0);
      setPurNotes('');
    } finally {
      setSubmittingPur(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) return;
    setSubmittingExp(true);
    try {
      await onAddExpense({
        category: expCategory,
        title: expTitle.trim(),
        amount: Number(expAmount) || 0,
        payment_method: expPayment,
        staff_id: activeStaff.id,
        notes: expNotes.trim() || undefined,
      });
      setExpTitle('');
      setExpAmount(0);
      setExpNotes('');
    } finally {
      setSubmittingExp(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    if (expFilterCat === 'all') return expenses;
    return expenses.filter((e) => e.category === expFilterCat);
  }, [expenses, expFilterCat]);

  const totalPurchasesVal = useMemo(
    () => roundMoney(purchases.reduce((s, p) => s + p.total_amount, 0)),
    [purchases]
  );
  const totalExpensesVal = useMemo(
    () => roundMoney(filteredExpenses.reduce((s, e) => s + e.amount, 0)),
    [filteredExpenses]
  );

  return (
    <div className="space-y-5">
      {/* Header + Folder Tabs */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">المشتريات والمصروفات النثرية</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              تسجيل فواتير توريد المخزن من الموردين، وإدارة المصروفات النثرية اليومية وربطها بدرج الوردية.
            </p>
          </div>
          {canExportExcel && (
            <button
              type="button"
              onClick={() => {
                playSoundEffect('click');
                if (subTab === 'purchases') {
                  exportToExcelXls({
                    filename: 'perfect_purchases_ledger',
                    sheetTitle: 'سجل فواتير المشتريات',
                    columns: [
                      { header: 'رقم المشتريات', value: (r) => r.purchase_number },
                      { header: 'التاريخ', value: (r) => formatDateTimeAr(r.created_at) },
                      { header: 'المورد', value: (r) => r.supplier_name },
                      { header: 'طريقة الدفع', value: (r) => getPaymentMethodLabel(r.payment_method, wallets) },
                      { header: 'الإجمالي', value: (r) => r.total_amount },
                      { header: 'المدفوع', value: (r) => r.paid_amount },
                    ],
                    rows: purchases,
                    footerNote: `إجمالي المشتريات: ${formatEGP(totalPurchasesVal)}`,
                  });
                } else {
                  exportToExcelXls({
                    filename: 'perfect_petty_expenses',
                    sheetTitle: 'سجل المصروفات النثرية',
                    columns: [
                      { header: 'الرقم', value: (r) => r.expense_number },
                      { header: 'التاريخ', value: (r) => formatDateTimeAr(r.created_at) },
                      { header: 'البند', value: (r) => EXPENSE_CATEGORY_LABELS[r.category] },
                      { header: 'البيان', value: (r) => r.title },
                      { header: 'طريقة الدفع', value: (r) => getPaymentMethodLabel(r.payment_method, wallets) },
                      { header: 'المبلغ', value: (r) => r.amount },
                    ],
                    rows: filteredExpenses,
                    footerNote: `إجمالي المصروفات: ${formatEGP(totalExpensesVal)}`,
                  });
                }
              }}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير إكسيل</span>
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="المشتريات والمصروفات"
          className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1"
        >
          {canManagePurchases && (
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'purchases'}
              onClick={() => setSubTab('purchases')}
              className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
                subTab === 'purchases'
                  ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                  : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>فواتير المشتريات والتوريد ({purchases.length})</span>
            </button>
          )}
          {canManageExpenses && (
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'expenses'}
              onClick={() => setSubTab('expenses')}
              className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border border-b-0 ${
                subTab === 'expenses'
                  ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                  : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>المصروفات النثرية ({expenses.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Purchases */}
      {subTab === 'purchases' && canManagePurchases && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* New Purchase Form (5 cols) */}
          <form
            onSubmit={handleSubmitPurchase}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 bg-sky-100/80 border-b border-sky-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">تسجيل فاتورة مشتريات للمخزن</h3>
              </div>
              <span className="font-mono-num text-xs font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-sky-200">
                {purCart.length} صنف
              </span>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="pur-supplier" className="block font-semibold text-slate-600 mb-1">
                    المورد
                  </label>
                  <select
                    id="pur-supplier"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="">-- مورد جديد / غير مسجل --</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pur-payment" className="block font-semibold text-slate-600 mb-1">
                    طريقة السداد
                  </label>
                  <select
                    id="pur-payment"
                    value={purPayment}
                    onChange={(e) => setPurPayment(e.target.value as PaymentMethod)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {paymentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedSupplierId && (
                <input
                  type="text"
                  value={customSupplierName}
                  onChange={(e) => setCustomSupplierName(e.target.value)}
                  placeholder="اكتب اسم المورد..."
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200"
                />
              )}

              {/* Quick Product Picker */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={purSearch}
                    onChange={(e) => setPurSearch(e.target.value)}
                    placeholder="اختر منتجاً لإضافته لفاتورة التوريد..."
                    className="w-full h-8 pr-8 pl-2 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProductToPurchase(p)}
                      className="px-2.5 py-1 rounded-lg border border-sky-200 bg-white hover:bg-blue-700 hover:text-white text-[11px] font-semibold text-slate-800 transition-colors"
                    >
                      + {p.name_ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Purchase Items */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-48 overflow-y-auto">
                {purCart.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    اضغط على أي منتج بالأعلى لإضافته لفاتورة المشتريات.
                  </div>
                ) : (
                  purCart.map((row) => (
                    <div key={row.product_id} className="p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {row.product_name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPurCart((prev) =>
                              prev.filter((r) => r.product_id !== row.product_id)
                            )
                          }
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPurCart((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id
                                    ? { ...r, quantity: Math.max(1, r.quantity - 1) }
                                    : r
                                )
                              )
                            }
                            className="w-6 h-6 rounded border border-slate-200 bg-slate-50 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              setPurCart((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id
                                    ? { ...r, quantity: Math.max(1, Number(e.target.value) || 1) }
                                    : r
                                )
                              )
                            }
                            className="w-12 h-7 text-center border border-slate-200 rounded font-mono-num"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPurCart((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id
                                    ? { ...r, quantity: r.quantity + 1 }
                                    : r
                                )
                              )
                            }
                            className="w-6 h-6 rounded border border-slate-200 bg-slate-50 flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            aria-label="تكلفة الوحدة"
                            value={row.unit_cost}
                            onChange={(e) =>
                              setPurCart((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id
                                    ? { ...r, unit_cost: Number(e.target.value) || 0 }
                                    : r
                                )
                              )
                            }
                            className="w-full h-7 px-2 rounded border border-slate-200 font-mono-num"
                          />
                        </div>

                        <div className="text-left font-mono-num font-bold text-slate-900">
                          {formatEGP(row.quantity * row.unit_cost)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="pur-vat" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ضريبة إضافية (إن وجدت)
                  </label>
                  <input
                    id="pur-vat"
                    type="number"
                    min={0}
                    step="any"
                    value={purVat}
                    onChange={(e) => setPurVat(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label htmlFor="pur-notes" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ملاحظات التوريد
                  </label>
                  <input
                    id="pur-notes"
                    type="text"
                    value={purNotes}
                    onChange={(e) => setPurNotes(e.target.value)}
                    placeholder="رقم فاتورة المورد..."
                    className="w-full h-8 px-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between font-bold text-sm">
                <span>إجمالي فاتورة المشتريات</span>
                <span className="font-mono-num text-blue-800">{formatEGP(purTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={purCart.length === 0 || submittingPur}
                className="btn-sheen w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold shadow-sm transition-all"
              >
                {submittingPur ? 'جاري التوريد...' : 'تأكيد فاتورة المشتريات وتحديث المخزن'}
              </button>
            </div>
          </form>

          {/* Purchases Ledger Table (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-stone-100/80 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">سجل فواتير المشتريات</h3>
              <span className="text-xs font-bold font-mono-num text-blue-800">
                الإجمالي: {formatEGP(totalPurchasesVal)}
              </span>
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">رقم الفاتورة</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">المورد</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الأصناف</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">السداد</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">الإجمالي</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">المدفوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {purchases.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono-num font-bold text-slate-900">
                          {po.purchase_number}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTimeAr(po.created_at)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {po.supplier_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 min-w-[160px]">
                        {po.items.map((it) => `${it.product_name} (${it.quantity})`).join('، ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {getPaymentMethodLabel(po.payment_method, wallets)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono-num font-bold text-slate-900 whitespace-nowrap">
                        {formatEGP(po.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                        {formatEGP(po.paid_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Petty Cash Expenses */}
      {subTab === 'expenses' && canManageExpenses && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSubmitExpense}
            className="lg:col-span-4 bg-orange-50/60 border border-orange-200 rounded-2xl shadow-sm p-5 space-y-3.5 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900">تسجيل مصروف نثري جديد</h3>

            <div>
              <label htmlFor="exp-category" className="block font-semibold text-slate-700 mb-1">
                تصنيف المصروف
              </label>
              <select
                id="exp-category"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                className="w-full h-9 px-2.5 rounded-xl border border-orange-200 bg-white"
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-title" className="block font-semibold text-slate-700 mb-1">
                بيان المصروف
              </label>
              <input
                id="exp-title"
                required
                type="text"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="مثال: فاتورة كهرباء / صيانة كمبريسور / ضيافة..."
                className="w-full h-9 px-3 rounded-xl border border-orange-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="exp-amount" className="block font-semibold text-slate-700 mb-1">
                  المبلغ (ج.م)
                </label>
                <input
                  id="exp-amount"
                  required
                  type="number"
                  min={1}
                  step="any"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(Number(e.target.value) || 0)}
                  className="w-full h-9 px-3 rounded-xl border border-orange-200 bg-white font-mono-num"
                />
              </div>
              <div>
                <label htmlFor="exp-payment" className="block font-semibold text-slate-700 mb-1">
                  مصدر الصرف
                </label>
                <select
                  id="exp-payment"
                  value={expPayment}
                  onChange={(e) => setExpPayment(e.target.value as PaymentMethod)}
                  className="w-full h-9 px-2 rounded-xl border border-orange-200 bg-white"
                >
                  <option value="cash">نقدي (من درج الوردية)</option>
                  {wallets
                    .filter((w) => w.is_active)
                    .map((w) => (
                      <option key={w.id} value={`wallet:${w.id}`}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="exp-notes" className="block font-semibold text-slate-700 mb-1">
                ملاحظات إضافية
              </label>
              <input
                id="exp-notes"
                type="text"
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
                placeholder="اختياري..."
                className="w-full h-9 px-3 rounded-xl border border-orange-200 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submittingExp || expAmount <= 0 || !expTitle.trim()}
              className="btn-sheen w-full h-10 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold shadow-sm transition-all"
            >
              {submittingExp ? 'جاري الحفظ...' : 'تسجيل المصروف وخصمه من الدرج'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-stone-100/80 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">سجل المصروفات النثرية</h3>
                <select
                  aria-label="تصفية المصروفات"
                  value={expFilterCat}
                  onChange={(e) => setExpFilterCat(e.target.value as 'all' | ExpenseCategory)}
                  className="h-8 px-2 rounded-lg border border-stone-300 bg-white text-xs"
                >
                  <option value="all">كل البنود</option>
                  {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs font-bold font-mono-num text-red-700">
                الإجمالي: {formatEGP(totalExpensesVal)}
              </span>
            </div>
            <div className="overflow-auto max-h-[460px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الرقم والتاريخ</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">التصنيف</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">البيان</th>
                    <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الدفع</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">المبلغ</th>
                    <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono-num font-bold text-slate-900">
                          {exp.expense_number}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTimeAr(exp.created_at)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-orange-800 whitespace-nowrap">
                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 min-w-[160px]">
                        <div className="font-semibold">{exp.title}</div>
                        {exp.notes && <div className="text-[11px] text-slate-500">{exp.notes}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {getPaymentMethodLabel(exp.payment_method, wallets)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono-num font-bold text-red-700 whitespace-nowrap">
                        {formatEGP(exp.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          aria-label="حذف المصروف"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
