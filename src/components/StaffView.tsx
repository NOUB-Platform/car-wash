import React, { useMemo, useState } from 'react';
import { Plus, UserPlus, Users, X } from 'lucide-react';
import { Invoice, StaffMember, StaffRole } from '../types/carwash';
import { formatEGP, roundMoney, STAFF_ROLE_LABELS } from '../utils/pricing';

interface StaffViewProps {
  staff: StaffMember[];
  invoices: Invoice[];
  onUpsertStaff: (
    data: Omit<StaffMember, 'id' | 'created_at'> & { id?: string }
  ) => Promise<void>;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  invoices,
  onUpsertStaff,
}) => {
  const [editingStaff, setEditingStaff] = useState<Partial<StaffMember> | null>(null);

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
      notes: editingStaff.notes || '',
    });
    setEditingStaff(null);
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

  return (
    <div className="space-y-6">
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            طاقم العمل والأدوار والعمولات
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            تتبع دقيق لمسؤولية كل فرد في المغسلة: من قام بالغسيل ومن أصدر الفاتورة ومن أتم البيع.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditingStaff({
              full_name: '',
              role: 'washer',
              role_title_ar: 'فني غسيل سيارات',
              phone: '',
              commission_rate: 8,
              base_salary: 6000,
              is_active: true,
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
            return (
              <div
                key={member.id}
                className={`${theme.card} border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border font-bold flex items-center justify-center shrink-0 shadow-xs ${theme.avatar}`}
                    >
                      {member.full_name.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {member.full_name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {member.role_title_ar} ·{' '}
                        <span className="font-mono-num">{member.phone}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingStaff(member)}
                    className="group px-2.5 py-1 rounded-lg border border-blue-200 bg-white/90 hover:bg-blue-700 hover:text-white hover:border-blue-700 text-xs font-bold text-blue-700 shadow-xs transition-all"
                  >
                    تعديل
                  </button>
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

      {/* Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingStaff.id ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
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
            <div className="p-6 space-y-4 text-xs">
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
                <span>حفظ الموظف</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
