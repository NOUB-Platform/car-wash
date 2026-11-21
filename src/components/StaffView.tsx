import React, { useMemo, useState } from 'react';
import {
  Banknote,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Invoice,
  PaymentMethod,
  PayrollPayout,
  StaffMember,
  StaffPermissions,
  StaffRole,
  WalletAccount,
} from '../types/carwash';
import { exportToExcelXls } from '../utils/excelExport';
import { playSoundEffect } from '../utils/feedback';
import {
  formatDateTimeAr,
  formatEGP,
  getDefaultPermissionsForRole,
  getPaymentMethodLabel,
  PERMISSION_LABELS,
  roundMoney,
  STAFF_ROLE_LABELS,
} from '../utils/pricing';

interface StaffViewProps {
  staff: StaffMember[];
  invoices: Invoice[];
  payrollPayouts: PayrollPayout[];
  wallets: WalletAccount[];
  canExportExcel: boolean;
  onUpsertStaff: (
    data: Omit<StaffMember, 'id' | 'created_at'> & { id?: string }
  ) => Promise<void>;
  onRecordPayroll: (params: Omit<PayrollPayout, 'id' | 'created_at'>) => Promise<void>;
}

interface PayrollDraft {
  staff_id: string;
  staff_name: string;
  month_label: string;
  base_salary: number;
  commission_amount: number;
  bonuses: number;
  deductions: number;
  payment_method: PaymentMethod;
  notes: string;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  invoices,
  payrollPayouts,
  wallets,
  canExportExcel,
  onUpsertStaff,
  onRecordPayroll,
}) => {
  const [editingStaff, setEditingStaff] = useState<Partial<StaffMember> | null>(null);
  const [payrollDraft, setPayrollDraft] = useState<PayrollDraft | null>(null);

  const staffPerformance = useMemo(() => {
    const validInvoices = invoices.filter((i) => i.status !== 'cancelled');
    return staff.map((member) => {
      const performed = validInvoices.filter(
        (i) => i.performed_by_staff_id === member.id
      );
      const issued = validInvoices.filter((i) => i.created_by_staff_id === member.id);
      const washesCount = performed.filter((i) => i.invoice_type === 'service').length;
      const retailSalesCount = performed.filter((i) => i.invoice_type === 'retail').length;
      const handledRevenue = roundMoney(
        performed.reduce((sum, i) => sum + i.taxable_amount, 0)
      );
      const commissionEarned = roundMoney(
        handledRevenue * (member.commission_rate / 100)
      );

      return {
        member,
        washesCount,
        retailSalesCount,
        issuedCount: issued.length,
        handledRevenue,
        commissionEarned,
        estimatedTotalPay: roundMoney(member.base_salary + commissionEarned),
      };
    });
  }, [staff, invoices]);

  const totalPayrollPaid = useMemo(
    () => roundMoney(payrollPayouts.reduce((s, p) => s + p.net_paid, 0)),
    [payrollPayouts]
  );

  const paymentOptions = useMemo(() => {
    const list: Array<{ value: PaymentMethod; label: string }> = [
      { value: 'cash', label: 'نقدي (من الدرج)' },
      { value: 'card', label: 'تحويل بنكي' },
    ];
    wallets
      .filter((w) => w.is_active)
      .forEach((w) =>
        list.push({ value: `wallet:${w.id}`, label: `${w.name} (${w.provider})` })
      );
    return list;
  }, [wallets]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editingStaff.full_name?.trim()) return;
    const role = (editingStaff.role || 'washer') as StaffRole;
    await onUpsertStaff({
      id: editingStaff.id,
      full_name: editingStaff.full_name.trim(),
      role,
      role_title_ar: editingStaff.role_title_ar || STAFF_ROLE_LABELS[role],
      phone: editingStaff.phone || '',
      commission_rate: Number(editingStaff.commission_rate) || 0,
      base_salary: Number(editingStaff.base_salary) || 0,
      is_active: editingStaff.is_active ?? true,
      permissions: editingStaff.permissions || getDefaultPermissionsForRole(role),
      notes: editingStaff.notes || '',
    });
    setEditingStaff(null);
  };

  const openPayrollModal = (member: StaffMember, commissionEarned: number) => {
    playSoundEffect('click');
    const now = new Date();
    const monthLabel = new Intl.DateTimeFormat('ar-EG', {
      month: 'long',
      year: 'numeric',
    }).format(now);
    setPayrollDraft({
      staff_id: member.id,
      staff_name: member.full_name,
      month_label: monthLabel,
      base_salary: member.base_salary,
      commission_amount: commissionEarned,
      bonuses: 0,
      deductions: 0,
      payment_method: 'cash',
      notes: '',
    });
  };

  const handleSubmitPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollDraft) return;
    const netPaid = roundMoney(
      Math.max(
        0,
        payrollDraft.base_salary +
          payrollDraft.commission_amount +
          payrollDraft.bonuses -
          payrollDraft.deductions
      )
    );
    await onRecordPayroll({
      staff_id: payrollDraft.staff_id,
      staff_name: payrollDraft.staff_name,
      month_label: payrollDraft.month_label.trim() || 'راتب شهري',
      base_salary: roundMoney(payrollDraft.base_salary),
      commission_amount: roundMoney(payrollDraft.commission_amount),
      bonuses: roundMoney(payrollDraft.bonuses),
      deductions: roundMoney(payrollDraft.deductions),
      net_paid: netPaid,
      payment_method: payrollDraft.payment_method,
      notes: payrollDraft.notes.trim() || undefined,
    });
    setPayrollDraft(null);
  };

  const handleExportPayrollExcel = () => {
    playSoundEffect('click');
    exportToExcelXls<PayrollPayout>({
      filename: 'perfect_payroll',
      sheetTitle: 'سجل الرواتب والعمولات',
      columns: [
        { header: 'التاريخ', value: (p) => formatDateTimeAr(p.created_at) },
        { header: 'الموظف', value: (p) => p.staff_name },
        { header: 'الشهر / البيان', value: (p) => p.month_label },
        { header: 'الراتب الأساسي', value: (p) => p.base_salary },
        { header: 'العمولة', value: (p) => p.commission_amount },
        { header: 'مكافآت', value: (p) => p.bonuses },
        { header: 'خصومات', value: (p) => p.deductions },
        { header: 'صافي المنصرف', value: (p) => p.net_paid },
        { header: 'طريقة الصرف', value: (p) => getPaymentMethodLabel(p.payment_method, wallets) },
        { header: 'ملاحظات', value: (p) => p.notes || '—' },
      ],
      rows: payrollPayouts,
    });
  };

  const getRoleCardStyle = (role: StaffRole) => {
    switch (role) {
      case 'washer':
        return {
          card: 'bg-sky-50/85 border-sky-200',
          avatar: 'bg-sky-100 border-sky-300 text-blue-800',
          box: 'bg-white/85 border-sky-200',
        };
      case 'detailer':
        return {
          card: 'bg-indigo-50/80 border-indigo-200',
          avatar: 'bg-indigo-100 border-indigo-300 text-indigo-800',
          box: 'bg-white/85 border-indigo-200',
        };
      case 'inventory_manager':
        return {
          card: 'bg-emerald-50/80 border-emerald-200',
          avatar: 'bg-emerald-100 border-emerald-300 text-emerald-800',
          box: 'bg-white/85 border-emerald-200',
        };
      case 'supervisor':
        return {
          card: 'bg-orange-50/80 border-orange-200',
          avatar: 'bg-orange-100 border-orange-300 text-orange-800',
          box: 'bg-white/85 border-orange-200',
        };
      default:
        return {
          card: 'bg-stone-100/85 border-stone-300',
          avatar: 'bg-stone-200/80 border-stone-300 text-stone-800',
          box: 'bg-white/85 border-stone-200',
        };
    }
  };

  const togglePermission = (key: keyof StaffPermissions) => {
    setEditingStaff((prev) => {
      if (!prev) return null;
      const role = (prev.role || 'washer') as StaffRole;
      const current = prev.permissions || getDefaultPermissionsForRole(role);
      return {
        ...prev,
        permissions: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            طاقم العمل والصلاحيات والرواتب والعمولات
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            إدارة صلاحيات الكاشير، عمولات التنفيذ والمبيعات، وصرف المرتبات الشهرية والسلف.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditingStaff({
              full_name: '',
              role: 'cashier',
              role_title_ar: STAFF_ROLE_LABELS.cashier,
              phone: '',
              commission_rate: 2,
              base_salary: 6500,
              is_active: true,
              permissions: getDefaultPermissionsForRole('cashier'),
            })
          }
          className="group btn-sheen h-10 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* Staff Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {staffPerformance.map(
          ({
            member,
            washesCount,
            retailSalesCount,
            issuedCount,
            handledRevenue,
            commissionEarned,
            estimatedTotalPay,
          }) => {
            const theme = getRoleCardStyle(member.role);
            const activePermsCount = Object.values(
              member.permissions || getDefaultPermissionsForRole(member.role)
            ).filter(Boolean).length;
            return (
              <div
                key={member.id}
                className={`${theme.card} border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border font-bold flex items-center justify-center shrink-0 shadow-xs ${theme.avatar}`}
                    >
                      {member.full_name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {member.full_name}
                      </h3>
                      <p className="text-xs text-slate-600 truncate">
                        {member.role_title_ar} ·{' '}
                        <span className="font-mono-num">{member.phone}</span>
                      </p>
                      <div className="text-[11px] text-blue-800 font-semibold mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{activePermsCount} صلاحية فعالة</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPayrollModal(member, commissionEarned)}
                      className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>صرف راتب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingStaff({
                          ...member,
                          permissions:
                            member.permissions || getDefaultPermissionsForRole(member.role),
                        })
                      }
                      className="group px-2.5 py-1 rounded-lg border border-blue-200 bg-white/90 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-xs font-bold text-blue-700 shadow-xs transition-all"
                    >
                      تعديل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-black/10 text-xs">
                  <div>
                    <span className="text-slate-600 block">عمليات غسيل</span>
                    <strong className="font-mono-num text-sm text-slate-900">
                      {washesCount}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-600 block">فواتير صادرة</span>
                    <strong className="font-mono-num text-sm text-slate-900">
                      {issuedCount}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-600 block">مبيعات منتجات</span>
                    <strong className="font-mono-num text-sm text-slate-900">
                      {retailSalesCount}
                    </strong>
                  </div>
                </div>

                <div className={`${theme.box} border rounded-xl p-3 space-y-1 text-xs shadow-xs`}>
                  <div className="flex justify-between">
                    <span className="text-slate-600">إيرادات منفذة (صافي)</span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatEGP(handledRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      العمولة المستحقة ({member.commission_rate}%)
                    </span>
                    <span className="font-mono-num font-semibold text-emerald-700">
                      + {formatEGP(commissionEarned)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                    <span>إجمالي المستحق (أساسي + عمولة)</span>
                    <span className="font-mono-num">{formatEGP(estimatedTotalPay)}</span>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Payroll History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-emerald-50/70 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              سجل صرف المرتبات والعمولات ({payrollPayouts.length})
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              إجمالي الرواتب المنصرفة:{' '}
              <strong className="font-mono-num text-emerald-800">
                {formatEGP(totalPayrollPaid)}
              </strong>
            </p>
          </div>
          {canExportExcel && (
            <button
              type="button"
              onClick={handleExportPayrollExcel}
              className="h-9 px-3.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير سجل الرواتب Excel</span>
            </button>
          )}
        </div>

        <div className="overflow-auto max-h-[320px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 text-right font-semibold">التاريخ</th>
                <th className="py-2.5 px-3 text-right font-semibold">الموظف</th>
                <th className="py-2.5 px-3 text-right font-semibold">الشهر / البيان</th>
                <th className="py-2.5 px-3 text-left font-semibold">الأساسي</th>
                <th className="py-2.5 px-3 text-left font-semibold">العمولة</th>
                <th className="py-2.5 px-3 text-left font-semibold">مكافآت</th>
                <th className="py-2.5 px-3 text-left font-semibold">خصومات</th>
                <th className="py-2.5 px-3 text-left font-semibold">صافي المنصرف</th>
                <th className="py-2.5 px-3 text-right font-semibold">طريقة الصرف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payrollPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                    {formatDateTimeAr(p.created_at)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                    {p.staff_name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{p.month_label}</td>
                  <td className="py-2.5 px-3 text-left font-mono-num">{formatEGP(p.base_salary)}</td>
                  <td className="py-2.5 px-3 text-left font-mono-num text-blue-700">
                    {formatEGP(p.commission_amount)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700">
                    {formatEGP(p.bonuses)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono-num text-red-600">
                    {formatEGP(p.deductions)}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono-num font-bold text-slate-900">
                    {formatEGP(p.net_paid)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {getPaymentMethodLabel(p.payment_method, wallets)}
                  </td>
                </tr>
              ))}
              {payrollPayouts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    لا توجد عمليات صرف رواتب مسجلة بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff & Permissions Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden my-6"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingStaff.id ? 'تعديل بيانات وصلاحيات الموظف' : 'إضافة موظف جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">الاسم الكامل</label>
                <input
                  required
                  type="text"
                  value={editingStaff.full_name || ''}
                  onChange={(e) =>
                    setEditingStaff((p) => ({ ...p, full_name: e.target.value }))
                  }
                  placeholder="مثال: أحمد مجدي"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الدور الوظيفي</label>
                  <select
                    value={editingStaff.role || 'washer'}
                    onChange={(e) => {
                      const r = e.target.value as StaffRole;
                      setEditingStaff((p) => ({
                        ...p,
                        role: r,
                        role_title_ar: STAFF_ROLE_LABELS[r],
                        permissions: getDefaultPermissionsForRole(r),
                      }));
                    }}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {STAFF_ROLE_LABELS[roleKey]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingStaff.phone || ''}
                    onChange={(e) =>
                      setEditingStaff((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    نسبة العمولة (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={editingStaff.commission_rate ?? 0}
                    onChange={(e) =>
                      setEditingStaff((p) => ({
                        ...p,
                        commission_rate: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    الراتب الأساسي (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingStaff.base_salary ?? 0}
                    onChange={(e) =>
                      setEditingStaff((p) => ({
                        ...p,
                        base_salary: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>

              {/* Granular Permissions Editor */}
              <div className="p-3.5 rounded-xl bg-sky-50/75 border border-sky-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>صلاحيات المستخدم / الكاشير</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingStaff((p) =>
                        p
                          ? {
                              ...p,
                              permissions: getDefaultPermissionsForRole(
                                (p.role || 'washer') as StaffRole
                              ),
                            }
                          : null
                      )
                    }
                    className="text-[11px] font-bold text-blue-700 hover:underline"
                  >
                    استعادة الافتراضي للدور
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(PERMISSION_LABELS) as Array<keyof StaffPermissions>).map((key) => {
                    const role = (editingStaff.role || 'washer') as StaffRole;
                    const perms = editingStaff.permissions || getDefaultPermissionsForRole(role);
                    const checked = Boolean(perms[key]);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 bg-white px-2.5 py-2 rounded-lg border border-sky-200 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(key)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <span className="text-[11px] font-semibold text-slate-800">
                          {PERMISSION_LABELS[key]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ الموظف والصلاحيات</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payroll Payout Modal */}
      {payrollDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPayroll}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  صرف راتب — {payrollDraft.staff_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayrollDraft(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">الشهر / البيان</label>
                <input
                  required
                  type="text"
                  value={payrollDraft.month_label}
                  onChange={(e) =>
                    setPayrollDraft((p) => (p ? { ...p, month_label: e.target.value } : null))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الراتب الأساسي</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payrollDraft.base_salary}
                    onChange={(e) =>
                      setPayrollDraft((p) =>
                        p ? { ...p, base_salary: Number(e.target.value) || 0 } : null
                      )
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">العمولة</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payrollDraft.commission_amount}
                    onChange={(e) =>
                      setPayrollDraft((p) =>
                        p ? { ...p, commission_amount: Number(e.target.value) || 0 } : null
                      )
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">مكافآت (+)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payrollDraft.bonuses}
                    onChange={(e) =>
                      setPayrollDraft((p) =>
                        p ? { ...p, bonuses: Number(e.target.value) || 0 } : null
                      )
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">خصومات / سلف (-)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payrollDraft.deductions}
                    onChange={(e) =>
                      setPayrollDraft((p) =>
                        p ? { ...p, deductions: Number(e.target.value) || 0 } : null
                      )
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">طريقة الصرف</label>
                <select
                  value={payrollDraft.payment_method}
                  onChange={(e) =>
                    setPayrollDraft((p) =>
                      p ? { ...p, payment_method: e.target.value as PaymentMethod } : null
                    )
                  }
                  className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white"
                >
                  {paymentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-slate-800">صافي الراتب المستحق للصرف</span>
                <strong className="font-mono-num text-base text-emerald-800">
                  {formatEGP(
                    Math.max(
                      0,
                      payrollDraft.base_salary +
                        payrollDraft.commission_amount +
                        payrollDraft.bonuses -
                        payrollDraft.deductions
                    )
                  )}
                </strong>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayrollDraft(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                تأكيد صرف الراتب
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
