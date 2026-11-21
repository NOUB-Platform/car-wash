import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Lock,
  Play,
  Printer,
  X,
} from 'lucide-react';
import { ShiftRecord, StaffMember } from '../types/carwash';
import { exportToExcelXls } from '../utils/excelExport';
import { playSoundEffect } from '../utils/feedback';
import { formatDateTimeAr, formatEGP, roundMoney } from '../utils/pricing';

interface ShiftsAuditViewProps {
  shifts: ShiftRecord[];
  activeStaff: StaffMember;
  canCloseShift: boolean;
  canExportExcel: boolean;
  businessName: string;
  onOpenShift: (params: {
    cashier_staff_id: string;
    cashier_name: string;
    opening_cash: number;
    notes?: string;
  }) => Promise<ShiftRecord>;
  onCloseShift: (params: {
    shift_id: string;
    actual_cash: number;
    notes?: string;
  }) => Promise<void>;
}

export const ShiftsAuditView: React.FC<ShiftsAuditViewProps> = ({
  shifts,
  activeStaff,
  canCloseShift,
  canExportExcel,
  businessName,
  onOpenShift,
  onCloseShift,
}) => {
  const openShift = useMemo(
    () => shifts.find((s) => s.status === 'open') || null,
    [shifts]
  );

  const [openingCash, setOpeningCash] = useState<number>(1500);
  const [openNotes, setOpenNotes] = useState<string>('');
  const [actualCash, setActualCash] = useState<string>(
    openShift ? String(openShift.expected_cash) : ''
  );
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [previewShift, setPreviewShift] = useState<ShiftRecord | null>(null);

  const liveVariance = useMemo(() => {
    if (!openShift) return 0;
    const counted = Number(actualCash);
    if (Number.isNaN(counted)) return 0;
    return roundMoney(counted - openShift.expected_cash);
  }, [openShift, actualCash]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await onOpenShift({
      cashier_staff_id: activeStaff.id,
      cashier_name: activeStaff.full_name,
      opening_cash: Number(openingCash) || 0,
      notes: openNotes.trim() || undefined,
    });
    setActualCash(String(created.expected_cash));
    setOpenNotes('');
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openShift || actualCash === '') return;
    await onCloseShift({
      shift_id: openShift.id,
      actual_cash: Number(actualCash) || 0,
      notes: closeNotes.trim() || undefined,
    });
    setCloseNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/95 border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            مراجعة اليومية والورديات وتقرير العجز والزيادة
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            متابعة الدرج النقدي للوردية المفتوحة، ومقارنة النقدية الفعلية بالمتوقعة لكشف أي عجز أو زيادة، واستعراض الورديات السابقة.
          </p>
        </div>
        {canExportExcel && (
          <button
            type="button"
            onClick={() => {
              playSoundEffect('click');
              exportToExcelXls({
                filename: 'perfect_shifts_audit',
                sheetTitle: 'سجل مراجعة الورديات والعجز والزيادة',
                columns: [
                  { header: 'رقم الوردية', value: (s) => s.shift_number },
                  { header: 'الكاشير', value: (s) => s.cashier_name },
                  { header: 'الحالة', value: (s) => (s.status === 'open' ? 'مفتوحة' : 'مغلقة') },
                  { header: 'بداية الوردية', value: (s) => formatDateTimeAr(s.opened_at) },
                  { header: 'عهدة البداية', value: (s) => s.opening_cash },
                  { header: 'مبيعات كاش', value: (s) => s.cash_sales },
                  { header: 'مبيعات محافظ', value: (s) => s.wallet_sales },
                  { header: 'مبيعات فيزا', value: (s) => s.card_sales },
                  { header: 'مصروفات كاش', value: (s) => s.cash_expenses },
                  { header: 'النقدية المتوقعة', value: (s) => s.expected_cash },
                  { header: 'الجرد الفعلي', value: (s) => s.actual_cash ?? '' },
                  { header: 'العجز / الزيادة', value: (s) => s.variance ?? '' },
                ],
                rows: shifts,
              });
            }}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير سجل الورديات</span>
          </button>
        )}
      </div>

      {/* Current Open Shift or Open New Shift Card */}
      {openShift ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Live Shift Breakdown */}
          <div className="lg:col-span-7 bg-sky-50/75 border border-sky-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    الوردية المفتوحة حالياً: <span className="font-mono-num">{openShift.shift_number}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    الكاشير المسؤول: <strong>{openShift.cashier_name}</strong> · فتحت في{' '}
                    {formatDateTimeAr(openShift.opened_at)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewShift(openShift)}
                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-700 hover:text-white text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>تقرير Z-Report</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/90 border border-sky-200 rounded-xl p-3">
                <div className="text-slate-500">عهدة بداية الدرج</div>
                <div className="text-sm font-bold font-mono-num text-slate-900 mt-1">
                  {formatEGP(openShift.opening_cash)}
                </div>
              </div>
              <div className="bg-white/90 border border-emerald-200 rounded-xl p-3">
                <div className="text-emerald-700 font-semibold">+ مبيعات كاش</div>
                <div className="text-sm font-bold font-mono-num text-emerald-800 mt-1">
                  {formatEGP(openShift.cash_sales)}
                </div>
              </div>
              <div className="bg-white/90 border border-emerald-200 rounded-xl p-3">
                <div className="text-emerald-700 font-semibold">+ تحصيل عملاء كاش</div>
                <div className="text-sm font-bold font-mono-num text-emerald-800 mt-1">
                  {formatEGP(openShift.customer_cash_collections)}
                </div>
              </div>
              <div className="bg-white/90 border border-red-200 rounded-xl p-3">
                <div className="text-red-700 font-semibold">- مصروفات كاش</div>
                <div className="text-sm font-bold font-mono-num text-red-700 mt-1">
                  {formatEGP(openShift.cash_expenses)}
                </div>
              </div>
              <div className="bg-white/90 border border-red-200 rounded-xl p-3">
                <div className="text-red-700 font-semibold">- مشتريات وسداد موردين</div>
                <div className="text-sm font-bold font-mono-num text-red-700 mt-1">
                  {formatEGP(openShift.cash_purchases + openShift.supplier_cash_payments)}
                </div>
              </div>
              <div className="bg-blue-700 text-white rounded-xl p-3 shadow-sm">
                <div className="text-blue-100 font-semibold">النقدية المتوقعة بالدرج</div>
                <div className="text-base font-bold font-mono-num mt-1">
                  {formatEGP(openShift.expected_cash)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-sky-200 text-xs">
              <div className="bg-white/80 rounded-lg p-2.5 border border-sky-200 flex justify-between">
                <span className="text-slate-600">محافظ إلكترونية</span>
                <strong className="font-mono-num text-blue-800">
                  {formatEGP(openShift.wallet_sales)}
                </strong>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-sky-200 flex justify-between">
                <span className="text-slate-600">بطاقات بنكية</span>
                <strong className="font-mono-num text-slate-900">
                  {formatEGP(openShift.card_sales)}
                </strong>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-sky-200 flex justify-between">
                <span className="text-slate-600">مبيعات آجل</span>
                <strong className="font-mono-num text-amber-700">
                  {formatEGP(openShift.deferred_sales)}
                </strong>
              </div>
            </div>
          </div>

          {/* Close Shift & Shortage/Surplus Audit Form */}
          <form
            onSubmit={handleClose}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <Lock className="w-4 h-4 text-slate-800" />
              <h3 className="text-sm font-bold text-slate-900">
                تقفيل الوردية وجرد العجز والزيادة
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-600">الرصيد الدفتري المتوقع بالدرج:</span>
              <strong className="text-sm font-mono-num text-blue-800">
                {formatEGP(openShift.expected_cash)}
              </strong>
            </div>

            <div>
              <label htmlFor="shift-actual-cash" className="block font-semibold text-slate-700 mb-1">
                النقدية الفعلية المعدودة في الدرج (ج.م)
              </label>
              <input
                id="shift-actual-cash"
                required
                disabled={!canCloseShift}
                type="number"
                min={0}
                step="any"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="أدخل المبلغ الفعلي المعدود..."
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono-num text-sm font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            {actualCash !== '' && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between font-bold ${
                  liveVariance === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : liveVariance > 0
                    ? 'bg-sky-50 border-sky-200 text-blue-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {liveVariance === 0 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {liveVariance === 0
                      ? 'الدرج مطابق تماماً (لا يوجد عجز أو زيادة)'
                      : liveVariance > 0
                      ? 'زيادة في الدرج (+)'
                      : 'عجز في الدرج (-)'}
                  </span>
                </div>
                <span className="font-mono-num text-sm">
                  {liveVariance > 0 ? `+${formatEGP(liveVariance)}` : formatEGP(liveVariance)}
                </span>
              </div>
            )}

            <div>
              <label htmlFor="shift-close-notes" className="block font-semibold text-slate-700 mb-1">
                ملاحظات التسليم والمراجعة
              </label>
              <input
                id="shift-close-notes"
                disabled={!canCloseShift}
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="ملاحظة عن سبب العجز/الزيادة أو تسليم الوردية..."
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={!canCloseShift || actualCash === ''}
              className="btn-sheen w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold shadow-sm transition-all"
            >
              {canCloseShift
                ? 'اعتماد وإغلاق الوردية الحالية'
                : 'لا تملك صلاحية إغلاق الوردية'}
            </button>
          </form>
        </div>
      ) : (
        <form
          onSubmit={handleOpen}
          className="bg-emerald-50/75 border border-emerald-200 rounded-2xl p-6 max-w-lg space-y-4 text-xs shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">فتح وردية جديدة</h3>
              <p className="text-slate-600">
                الكاشير الحالي: <strong>{activeStaff.full_name}</strong>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                عهدة بداية الدرج (ج.م)
              </label>
              <input
                required
                type="number"
                min={0}
                step="any"
                value={openingCash}
                onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-xl border border-emerald-200 bg-white font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ملاحظات الافتتاح</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="الوردية المسائية..."
                className="w-full h-9 px-3 rounded-xl border border-emerald-200 bg-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!canCloseShift}
            className="btn-sheen px-5 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold"
          >
            بدء وفتح الوردية الآن
          </button>
        </form>
      )}

      {/* Previous & Current Shifts History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-stone-100/80 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">سجل الورديات السابقة والحالية</h3>
          <span className="text-xs text-slate-600 font-mono-num">{shifts.length} وردية</span>
        </div>
        <div className="overflow-auto max-h-[380px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">رقم الوردية</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الكاشير</th>
                <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">الحالة</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">العهدة</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">كاش</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">محافظ/فيزا</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">مصروفات كاش</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">المتوقع</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">الفعلي</th>
                <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">العجز / الزيادة</th>
                <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">التقرير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shifts.map((sh) => {
                const variance = sh.variance ?? 0;
                return (
                  <tr key={sh.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono-num font-bold text-slate-900">{sh.shift_number}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatDateTimeAr(sh.opened_at)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {sh.cashier_name}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                          sh.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {sh.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num whitespace-nowrap">
                      {formatEGP(sh.opening_cash)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700 whitespace-nowrap">
                      {formatEGP(sh.cash_sales)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-blue-700 whitespace-nowrap">
                      {formatEGP(sh.wallet_sales + sh.card_sales)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-red-700 whitespace-nowrap">
                      {formatEGP(sh.cash_expenses)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num font-bold whitespace-nowrap">
                      {formatEGP(sh.expected_cash)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num whitespace-nowrap">
                      {sh.actual_cash !== null && sh.actual_cash !== undefined
                        ? formatEGP(sh.actual_cash)
                        : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-left font-mono-num font-bold whitespace-nowrap ${
                        sh.status === 'open'
                          ? 'text-slate-400'
                          : variance === 0
                          ? 'text-emerald-700'
                          : variance > 0
                          ? 'text-blue-700'
                          : 'text-red-700'
                      }`}
                    >
                      {sh.status === 'open'
                        ? 'جارية'
                        : variance === 0
                        ? 'مطابق (0.00)'
                        : variance > 0
                        ? `+${formatEGP(variance)} زيادة`
                        : `${formatEGP(variance)} عجز`}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewShift(sh)}
                        className="px-2.5 py-1 rounded-lg border border-blue-200 bg-sky-50 hover:bg-blue-700 hover:text-white text-blue-700 font-semibold inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        <span>طباعة</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Z-Report Print Modal */}
      {previewShift && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setPreviewShift(null)}
        >
          <div
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl overflow-hidden print-only-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                تقرير وردية تفصيلي ({previewShift.shift_number})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewShift(null)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <div className="text-base font-bold text-slate-900">{businessName}</div>
                <div className="text-slate-600 mt-0.5">
                  تقرير مراجعة الوردية — <span className="font-mono-num">{previewShift.shift_number}</span>
                </div>
                <div className="text-slate-500 mt-0.5">
                  الكاشير: <strong>{previewShift.cashier_name}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>عهدة البداية</span>
                  <span className="font-mono-num">{formatEGP(previewShift.opening_cash)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>+ مبيعات كاش</span>
                  <span className="font-mono-num">{formatEGP(previewShift.cash_sales)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>+ تحصيل عملاء كاش</span>
                  <span className="font-mono-num">
                    {formatEGP(previewShift.customer_cash_collections)}
                  </span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>- مصروفات نقدية</span>
                  <span className="font-mono-num">{formatEGP(previewShift.cash_expenses)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>- مشتريات وسداد موردين نقداً</span>
                  <span className="font-mono-num">
                    {formatEGP(previewShift.cash_purchases + previewShift.supplier_cash_payments)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm">
                  <span>المتوقع بالدرج</span>
                  <span className="font-mono-num">{formatEGP(previewShift.expected_cash)}</span>
                </div>
                {previewShift.actual_cash !== null && previewShift.actual_cash !== undefined && (
                  <>
                    <div className="flex justify-between font-bold">
                      <span>النقدية المعدودة فعلياً</span>
                      <span className="font-mono-num">{formatEGP(previewShift.actual_cash)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>الفرق (العجز / الزيادة)</span>
                      <span className="font-mono-num">{formatEGP(previewShift.variance || 0)}</span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>إجمالي مبيعات المحافظ الإلكترونية</span>
                    <span className="font-mono-num">{formatEGP(previewShift.wallet_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>إجمالي مبيعات البطاقات البنكية</span>
                    <span className="font-mono-num">{formatEGP(previewShift.card_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>إجمالي الفواتير الآجلة</span>
                    <span className="font-mono-num">{formatEGP(previewShift.deferred_sales)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
