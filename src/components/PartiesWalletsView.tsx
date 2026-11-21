import React, { useMemo, useState } from 'react';
import {
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Customer,
  Invoice,
  PartyPayment,
  PaymentMethod,
  PurchaseOrder,
  StaffMember,
  Supplier,
  VehicleTier,
  WalletAccount,
} from '../types/carwash';
import { exportToExcelXls } from '../utils/excelExport';
import { playSoundEffect } from '../utils/feedback';
import {
  formatDateTimeAr,
  formatEGP,
  getPaymentMethodLabel,
  roundMoney,
  VEHICLE_TIER_LABELS,
} from '../utils/pricing';

interface PartiesWalletsViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  wallets: WalletAccount[];
  invoices: Invoice[];
  purchases: PurchaseOrder[];
  partyPayments: PartyPayment[];
  activeStaff: StaffMember;
  canExportExcel: boolean;
  onUpsertCustomer: (data: Omit<Customer, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onUpsertSupplier: (data: Omit<Supplier, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onUpsertWallet: (data: Omit<WalletAccount, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onDeleteWallet: (id: string) => Promise<void>;
  onRecordPartyPayment: (params: {
    party_type: 'customer' | 'supplier';
    party_id: string;
    party_name: string;
    amount: number;
    payment_method: PaymentMethod;
    staff_id: string;
    notes?: string;
  }) => Promise<void>;
}

interface StatementRow {
  date: string;
  doc: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export const PartiesWalletsView: React.FC<PartiesWalletsViewProps> = ({
  customers,
  suppliers,
  wallets,
  invoices,
  purchases,
  partyPayments,
  activeStaff,
  canExportExcel,
  onUpsertCustomer,
  onUpsertSupplier,
  onUpsertWallet,
  onDeleteWallet,
  onRecordPartyPayment,
}) => {
  const [subTab, setSubTab] = useState<'customers' | 'suppliers' | 'wallets'>('customers');
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [editingWallet, setEditingWallet] = useState<Partial<WalletAccount> | null>(null);

  // Payment / collection modal
  const [paymentModal, setPaymentModal] = useState<{
    partyType: 'customer' | 'supplier';
    partyId: string;
    partyName: string;
    currentBalance: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState<string>('');

  // Statement of account modal
  const [statementTarget, setStatementTarget] = useState<{
    partyType: 'customer' | 'supplier';
    partyId: string;
    partyName: string;
    phone: string;
  } | null>(null);

  const customerSummaries = useMemo(() => {
    return customers.map((c) => {
      const custInvs = invoices.filter((i) => i.customer_id === c.id && i.status !== 'cancelled');
      const totalInvoices = roundMoney(custInvs.reduce((s, i) => s + i.total_amount, 0));
      const deferredSum = roundMoney(
        custInvs
          .filter((i) => i.payment_method === 'deferred')
          .reduce((s, i) => s + i.total_amount, 0)
      );
      const collected = roundMoney(
        partyPayments
          .filter((p) => p.party_type === 'customer' && p.party_id === c.id)
          .reduce((s, p) => s + p.amount, 0)
      );
      const balance = roundMoney((c.opening_balance || 0) + deferredSum - collected);
      return { customer: c, totalInvoices, deferredSum, collected, balance };
    });
  }, [customers, invoices, partyPayments]);

  const supplierSummaries = useMemo(() => {
    return suppliers.map((sup) => {
      const supPos = purchases.filter((p) => p.supplier_id === sup.id);
      const totalPurchases = roundMoney(supPos.reduce((s, p) => s + p.total_amount, 0));
      const deferredPurchases = roundMoney(
        supPos.reduce((s, p) => s + Math.max(0, p.total_amount - p.paid_amount), 0)
      );
      const paidAfter = roundMoney(
        partyPayments
          .filter((p) => p.party_type === 'supplier' && p.party_id === sup.id)
          .reduce((s, p) => s + p.amount, 0)
      );
      const balance = roundMoney((sup.opening_balance || 0) + deferredPurchases - paidAfter);
      return { supplier: sup, totalPurchases, deferredPurchases, paidAfter, balance };
    });
  }, [suppliers, purchases, partyPayments]);

  const statementRows = useMemo<StatementRow[]>(() => {
    if (!statementTarget) return [];
    const entries: Array<Omit<StatementRow, 'balance'>> = [];

    if (statementTarget.partyType === 'customer') {
      const cust = customers.find((c) => c.id === statementTarget.partyId);
      if (cust && (cust.opening_balance || 0) > 0) {
        entries.push({
          date: cust.created_at,
          doc: 'رصيد أول',
          description: 'رصيد افتتاحي مستحق على العميل',
          debit: cust.opening_balance || 0,
          credit: 0,
        });
      }
      invoices
        .filter((i) => i.customer_id === statementTarget.partyId && i.status !== 'cancelled')
        .forEach((inv) => {
          const isDeferred = inv.payment_method === 'deferred';
          entries.push({
            date: inv.created_at,
            doc: inv.invoice_number,
            description: `${inv.invoice_type === 'service' ? 'فاتورة غسيل' : 'فاتورة مبيعات'} (${getPaymentMethodLabel(inv.payment_method, wallets)})`,
            debit: inv.total_amount,
            credit: isDeferred ? 0 : inv.total_amount,
          });
        });
      partyPayments
        .filter((p) => p.party_type === 'customer' && p.party_id === statementTarget.partyId)
        .forEach((pay) => {
          entries.push({
            date: pay.created_at,
            doc: 'تحصيل',
            description: `${pay.notes || 'سداد دفعة نقدية'} (${getPaymentMethodLabel(pay.payment_method, wallets)})`,
            debit: 0,
            credit: pay.amount,
          });
        });
    } else {
      const sup = suppliers.find((s) => s.id === statementTarget.partyId);
      if (sup && sup.opening_balance > 0) {
        entries.push({
          date: sup.created_at,
          doc: 'رصيد أول',
          description: 'رصيد افتتاحي مستحق للمورد',
          debit: sup.opening_balance,
          credit: 0,
        });
      }
      purchases
        .filter((p) => p.supplier_id === statementTarget.partyId)
        .forEach((po) => {
          entries.push({
            date: po.created_at,
            doc: po.purchase_number,
            description: `فاتورة مشتريات (${getPaymentMethodLabel(po.payment_method, wallets)})`,
            debit: po.total_amount,
            credit: po.paid_amount,
          });
        });
      partyPayments
        .filter((p) => p.party_type === 'supplier' && p.party_id === statementTarget.partyId)
        .forEach((pay) => {
          entries.push({
            date: pay.created_at,
            doc: 'سداد',
            description: `${pay.notes || 'سداد دفعة للمورد'} (${getPaymentMethodLabel(pay.payment_method, wallets)})`,
            debit: 0,
            credit: pay.amount,
          });
        });
    }

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return entries.map((e) => {
      running = roundMoney(running + e.debit - e.credit);
      return { ...e, balance: running };
    });
  }, [statementTarget, customers, suppliers, invoices, purchases, partyPayments, wallets]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer?.full_name?.trim()) return;
    await onUpsertCustomer({
      id: editingCustomer.id,
      full_name: editingCustomer.full_name.trim(),
      phone: editingCustomer.phone || '',
      car_model: editingCustomer.car_model || '',
      car_plate: editingCustomer.car_plate || '',
      vehicle_tier: (editingCustomer.vehicle_tier || 'sedan') as VehicleTier,
      opening_balance: Number(editingCustomer.opening_balance) || 0,
      notes: editingCustomer.notes || '',
    });
    setEditingCustomer(null);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name?.trim()) return;
    await onUpsertSupplier({
      id: editingSupplier.id,
      name: editingSupplier.name.trim(),
      phone: editingSupplier.phone || '',
      company_name: editingSupplier.company_name || '',
      address: editingSupplier.address || '',
      opening_balance: Number(editingSupplier.opening_balance) || 0,
      notes: editingSupplier.notes || '',
    });
    setEditingSupplier(null);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet?.name?.trim() || !editingWallet.account_number?.trim()) return;
    await onUpsertWallet({
      id: editingWallet.id,
      name: editingWallet.name.trim(),
      provider: editingWallet.provider || 'Vodafone Cash',
      account_number: editingWallet.account_number.trim(),
      current_balance: Number(editingWallet.current_balance) || 0,
      is_active: editingWallet.is_active ?? true,
    });
    setEditingWallet(null);
  };

  const handleConfirmPartyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || payAmount <= 0) return;
    await onRecordPartyPayment({
      party_type: paymentModal.partyType,
      party_id: paymentModal.partyId,
      party_name: paymentModal.partyName,
      amount: payAmount,
      payment_method: payMethod,
      staff_id: activeStaff.id,
      notes: payNotes.trim() || undefined,
    });
    setPaymentModal(null);
    setPayAmount(0);
    setPayNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Folder Tabs */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm pt-3.5 px-4 overflow-hidden">
        <div className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              العملاء والموردين وكشوف الحساب والمحافظ الإلكترونية
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              متابعة الأرصدة الآجلة والتحصيل والسداد وكشوف الحساب التفصيلية وإدارة المحافظ الإلكترونية.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'customers' && (
              <button
                type="button"
                onClick={() =>
                  setEditingCustomer({
                    full_name: '',
                    phone: '',
                    car_model: '',
                    car_plate: '',
                    vehicle_tier: 'sedan',
                    opening_balance: 0,
                  })
                }
                className="btn-sheen h-9 px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة عميل</span>
              </button>
            )}
            {subTab === 'suppliers' && (
              <button
                type="button"
                onClick={() =>
                  setEditingSupplier({
                    name: '',
                    phone: '',
                    company_name: '',
                    address: '',
                    opening_balance: 0,
                  })
                }
                className="btn-sheen h-9 px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مورد</span>
              </button>
            )}
            {subTab === 'wallets' && (
              <button
                type="button"
                onClick={() =>
                  setEditingWallet({
                    name: '',
                    provider: 'Vodafone Cash',
                    account_number: '',
                    current_balance: 0,
                    is_active: true,
                  })
                }
                className="btn-sheen h-9 px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة محفظة إلكترونية</span>
              </button>
            )}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="أقسام الحسابات والمحافظ"
          className="flex flex-wrap items-end gap-1.5 border-b-2 border-teal-700 pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'customers'}
            onClick={() => setSubTab('customers')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-b-0 ${
              subTab === 'customers'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>العملاء وكشف الحساب ({customers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'suppliers'}
            onClick={() => setSubTab('suppliers')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-b-0 ${
              subTab === 'suppliers'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>الموردين وكشف الحساب ({suppliers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'wallets'}
            onClick={() => setSubTab('wallets')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-b-0 ${
              subTab === 'wallets'
                ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>المحافظ الإلكترونية ({wallets.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Customers */}
      {subTab === 'customers' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[260px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-right font-semibold">العميل والسيارة</th>
                  <th className="py-2.5 px-3 text-right font-semibold">الهاتف</th>
                  <th className="py-2.5 px-3 text-left font-semibold">إجمالي الفواتير</th>
                  <th className="py-2.5 px-3 text-left font-semibold">فواتير آجل</th>
                  <th className="py-2.5 px-3 text-left font-semibold">التحصيل</th>
                  <th className="py-2.5 px-3 text-left font-semibold">الرصيد المستحق</th>
                  <th className="py-2.5 px-3 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customerSummaries.map(
                  ({ customer, totalInvoices, deferredSum, collected, balance }) => (
                    <tr key={customer.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{customer.full_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {customer.car_model || '—'} · {customer.car_plate || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-700">{customer.phone}</td>
                      <td className="py-2.5 px-3 text-left font-mono-num">
                        {formatEGP(totalInvoices)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono-num text-amber-700">
                        {formatEGP(deferredSum)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700">
                        {formatEGP(collected)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-left font-mono-num font-bold ${
                          balance > 0 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatEGP(balance)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setStatementTarget({
                                partyType: 'customer',
                                partyId: customer.id,
                                partyName: customer.full_name,
                                phone: customer.phone,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg border border-blue-200 bg-sky-50 hover:bg-blue-700 hover:text-white text-blue-700 font-semibold inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>كشف حساب</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModal({
                                partyType: 'customer',
                                partyId: customer.id,
                                partyName: customer.full_name,
                                currentBalance: balance,
                              });
                              setPayAmount(Math.max(0, balance));
                            }}
                            className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 font-semibold"
                          >
                            تحصيل دفعة
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCustomer(customer)}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                          >
                            تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Suppliers */}
      {subTab === 'suppliers' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[260px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-right font-semibold">المورد / الشركة</th>
                  <th className="py-2.5 px-3 text-right font-semibold">الهاتف والعنوان</th>
                  <th className="py-2.5 px-3 text-left font-semibold">إجمالي المشتريات</th>
                  <th className="py-2.5 px-3 text-left font-semibold">سدادات</th>
                  <th className="py-2.5 px-3 text-left font-semibold">المستحق للمورد</th>
                  <th className="py-2.5 px-3 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {supplierSummaries.map(({ supplier, totalPurchases, paidAfter, balance }) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{supplier.name}</div>
                      {supplier.company_name && (
                        <div className="text-[11px] text-slate-500">{supplier.company_name}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono-num text-slate-700">{supplier.phone}</div>
                      <div className="text-[11px] text-slate-500">{supplier.address || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num">
                      {formatEGP(totalPurchases)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono-num text-emerald-700">
                      {formatEGP(paidAfter)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-left font-mono-num font-bold ${
                        balance > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatEGP(balance)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setStatementTarget({
                              partyType: 'supplier',
                              partyId: supplier.id,
                              partyName: supplier.name,
                              phone: supplier.phone,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-blue-200 bg-sky-50 hover:bg-blue-700 hover:text-white text-blue-700 font-semibold inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>كشف حساب</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModal({
                              partyType: 'supplier',
                              partyId: supplier.id,
                              partyName: supplier.name,
                              currentBalance: balance,
                            });
                            setPayAmount(Math.max(0, balance));
                          }}
                          className="px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-600 hover:text-white text-orange-800 font-semibold"
                        >
                          سداد دفعة
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSupplier(supplier)}
                          className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                        >
                          تعديل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: E-Wallets */}
      {subTab === 'wallets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="bg-sky-50/75 border border-sky-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{w.name}</h3>
                    <div className="text-xs text-slate-600">
                      {w.provider} ·{' '}
                      <span className="font-mono-num">{w.account_number}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    w.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {w.is_active ? 'مفعلة' : 'موقوفة'}
                </span>
              </div>

              <div className="bg-white/90 border border-sky-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-semibold">الرصيد الحالي</span>
                <span className="text-base font-bold font-mono-num text-blue-800">
                  {formatEGP(w.current_balance)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingWallet(w)}
                  className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-700 hover:text-white text-blue-700 font-bold transition-colors"
                >
                  تعديل الرصيد / البيانات
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteWallet(w.id)}
                  aria-label="حذف المحفظة"
                  className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statement of Account Modal */}
      {statementTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setStatementTarget(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden print-only-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  كشف حساب تفصيلي: {statementTarget.partyName}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono-num">{statementTarget.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                {canExportExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      playSoundEffect('click');
                      exportToExcelXls({
                        filename: `statement_${statementTarget.partyName}`,
                        sheetTitle: `كشف حساب ${statementTarget.partyName}`,
                        columns: [
                          { header: 'التاريخ', value: (r) => formatDateTimeAr(r.date) },
                          { header: 'المستند', value: (r) => r.doc },
                          { header: 'البيان', value: (r) => r.description },
                          { header: 'مدين (+)', value: (r) => r.debit },
                          { header: 'دائن (-)', value: (r) => r.credit },
                          { header: 'الرصيد', value: (r) => r.balance },
                        ],
                        rows: statementRows,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>إكسيل</span>
                  </button>
                )}
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
                  onClick={() => setStatementTarget(null)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 hidden print:block">
                <h2 className="text-base font-bold">
                  بيرفكت | Perfect — كشف حساب ({statementTarget.partyName})
                </h2>
              </div>
              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-2 px-3 text-right">التاريخ</th>
                    <th className="py-2 px-3 text-right">المرجع</th>
                    <th className="py-2 px-3 text-right">البيان</th>
                    <th className="py-2 px-3 text-left">عليه (مدين)</th>
                    <th className="py-2 px-3 text-left">سداد (دائن)</th>
                    <th className="py-2 px-3 text-left">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        لا توجد حركات مسجلة لهذا الحساب حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    statementRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTimeAr(row.date)}
                        </td>
                        <td className="py-2 px-3 font-mono-num font-bold text-slate-900">
                          {row.doc}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{row.description}</td>
                        <td className="py-2 px-3 text-left font-mono-num text-red-700">
                          {row.debit > 0 ? formatEGP(row.debit) : '—'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono-num text-emerald-700">
                          {row.credit > 0 ? formatEGP(row.credit) : '—'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono-num font-bold text-slate-900">
                          {formatEGP(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Collection / Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPartyPayment}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {paymentModal.partyType === 'customer'
                  ? `تحصيل دفعة من العميل: ${paymentModal.partyName}`
                  : `سداد دفعة للمورد: ${paymentModal.partyName}`}
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="p-1 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span>الرصيد المستحق حالياً</span>
                <strong className="font-mono-num text-blue-800">
                  {formatEGP(paymentModal.currentBalance)}
                </strong>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">المبلغ (ج.م)</label>
                <input
                  required
                  type="number"
                  min={1}
                  step="any"
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">طريقة الدفع</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="cash">نقدي (كاش / درج الوردية)</option>
                  {wallets
                    .filter((w) => w.is_active)
                    .map((w) => (
                      <option key={w.id} value={`wallet:${w.id}`}>
                        {w.name} ({w.provider})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="رقم إيصال أو ملاحظة..."
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold"
              >
                تأكيد العملية
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCustomer.id ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button type="button" onClick={() => setEditingCustomer(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">اسم العميل</label>
                <input
                  required
                  type="text"
                  value={editingCustomer.full_name || ''}
                  onChange={(e) => setEditingCustomer((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الهاتف</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الرصيد الافتتاحي</label>
                  <input
                    type="number"
                    step="any"
                    value={editingCustomer.opening_balance ?? 0}
                    onChange={(e) =>
                      setEditingCustomer((p) => ({
                        ...p,
                        opening_balance: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">السيارة</label>
                  <input
                    type="text"
                    value={editingCustomer.car_model || ''}
                    onChange={(e) => setEditingCustomer((p) => ({ ...p, car_model: e.target.value }))}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">اللوحة</label>
                  <input
                    type="text"
                    value={editingCustomer.car_plate || ''}
                    onChange={(e) => setEditingCustomer((p) => ({ ...p, car_plate: e.target.value }))}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الفئة</label>
                  <select
                    value={editingCustomer.vehicle_tier || 'sedan'}
                    onChange={(e) =>
                      setEditingCustomer((p) => ({
                        ...p,
                        vehicle_tier: e.target.value as VehicleTier,
                      }))
                    }
                    className="w-full h-9 px-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    {(Object.keys(VEHICLE_TIER_LABELS) as VehicleTier[]).map((t) => (
                      <option key={t} value={t}>
                        {VEHICLE_TIER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
              >
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-700 text-white font-bold">
                حفظ العميل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSupplier}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSupplier.id ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button type="button" onClick={() => setEditingSupplier(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">اسم المورد</label>
                <input
                  required
                  type="text"
                  value={editingSupplier.name || ''}
                  onChange={(e) => setEditingSupplier((p) => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الشركة</label>
                  <input
                    type="text"
                    value={editingSupplier.company_name || ''}
                    onChange={(e) =>
                      setEditingSupplier((p) => ({ ...p, company_name: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الهاتف</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">العنوان</label>
                  <input
                    type="text"
                    value={editingSupplier.address || ''}
                    onChange={(e) => setEditingSupplier((p) => ({ ...p, address: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الرصيد الافتتاحي</label>
                  <input
                    type="number"
                    step="any"
                    value={editingSupplier.opening_balance ?? 0}
                    onChange={(e) =>
                      setEditingSupplier((p) => ({
                        ...p,
                        opening_balance: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
              >
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-700 text-white font-bold">
                حفظ المورد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Wallet Modal */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveWallet}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingWallet.id ? 'تعديل المحفظة الإلكترونية' : 'إضافة محفظة إلكترونية جديدة'}
              </h3>
              <button type="button" onClick={() => setEditingWallet(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">اسم المحفظة</label>
                <input
                  required
                  type="text"
                  value={editingWallet.name || ''}
                  onChange={(e) => setEditingWallet((p) => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: محفظة فودافون كاش 2"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">المزود</label>
                  <select
                    value={editingWallet.provider || 'Vodafone Cash'}
                    onChange={(e) => setEditingWallet((p) => ({ ...p, provider: e.target.value }))}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Vodafone Cash">فودافون كاش</option>
                    <option value="InstaPay">إنستاباي InstaPay</option>
                    <option value="Etisalat Cash">اتصالات كاش</option>
                    <option value="Orange Cash">أورنج كاش</option>
                    <option value="WE Pay">WE Pay</option>
                    <option value="Bank Wallet">محفظة بنكية</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">رقم المحفظة / الحساب</label>
                  <input
                    required
                    type="text"
                    dir="ltr"
                    value={editingWallet.account_number || ''}
                    onChange={(e) =>
                      setEditingWallet((p) => ({ ...p, account_number: e.target.value }))
                    }
                    placeholder="010..."
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">الرصيد الحالي (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingWallet.current_balance ?? 0}
                    onChange={(e) =>
                      setEditingWallet((p) => ({
                        ...p,
                        current_balance: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono-num"
                  />
                </div>
                <label className="flex items-center gap-2 h-9 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingWallet.is_active ?? true}
                    onChange={(e) =>
                      setEditingWallet((p) => ({ ...p, is_active: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-blue-700"
                  />
                  <span>المحفظة مفعلة في نقطة البيع</span>
                </label>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingWallet(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
              >
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-700 text-white font-bold">
                حفظ المحفظة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
