import React, { useCallback, useState } from 'react';
import {
  AlertCircle,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  Info,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { DashboardView } from './components/DashboardView';
import { DatabaseSettingsView } from './components/DatabaseSettingsView';
import { InventoryPricingView } from './components/InventoryPricingView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { InvoicesLedgerView } from './components/InvoicesLedgerView';
import { PasscodeLockScreen } from './components/PasscodeLockScreen';
import { PosView } from './components/PosView';
import { StaffView } from './components/StaffView';
import { useCarWashStore } from './store/useCarWashStore';
import { Invoice, InvoiceStatus, InvoiceType } from './types/carwash';
import {
  isSoundEnabled,
  playSoundEffect,
  setSoundEnabledPref,
  SoundEffectType,
} from './utils/feedback';
import { INVOICE_STATUS_LABELS } from './utils/pricing';

type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'invoices'
  | 'inventory'
  | 'staff'
  | 'database';

const TAB_LABELS: Record<ActiveTab, string> = {
  dashboard: 'لوحة العمليات اليومية',
  pos: 'كاشير الغسيل والمبيعات',
  invoices: 'سجل الفواتير والطباعة',
  inventory: 'المخزن والتسعير',
  staff: 'طاقم العمل والعمولات',
  database: 'الإعدادات',
};

const SESSION_UNLOCK_KEY = 'naqaa_terminal_unlocked';
const SIDEBAR_COLLAPSED_KEY = 'washcare_sidebar_collapsed_v1';
const SETTINGS_PASSCODE = '87654321';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'info' | 'warning';
}

export function App() {
  const store = useCarWashStore();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_UNLOCK_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isSoundEnabled());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [posInitialMode, setPosInitialMode] = useState<InvoiceType>('service');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings security gate state (auto-locks when navigating away)
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPassInput, setSettingsPassInput] = useState('');
  const [settingsPassError, setSettingsPassError] = useState<string | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (
      title: string,
      description?: string,
      tone: ToastItem['tone'] = 'success',
      sound: SoundEffectType = 'success'
    ) => {
      playSoundEffect(sound);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const toggleSidebarCollapsed = () => {
    playSoundEffect('click');
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setSoundEnabledPref(next);
      if (next) {
        setTimeout(() => playSoundEffect('click'), 20);
      }
      return next;
    });
  };

  const navigateTab = (tab: ActiveTab) => {
    playSoundEffect('click');
    if (tab !== 'database') {
      setSettingsUnlocked(false);
      setSettingsPassInput('');
      setSettingsPassError(null);
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleUnlock = () => {
    try {
      sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
    } catch {
      // Ignore storage error
    }
    playSoundEffect('success');
    setUnlocked(true);
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    } catch {
      // Ignore storage error
    }
    playSoundEffect('click');
    setSettingsUnlocked(false);
    setSettingsPassInput('');
    setUnlocked(false);
  };

  const handleOpenPos = (mode: InvoiceType) => {
    setPosInitialMode(mode);
    navigateTab('pos');
  };

  const handleUnlockSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsPassInput.trim() === SETTINGS_PASSCODE) {
      playSoundEffect('success');
      setSettingsUnlocked(true);
      setSettingsPassInput('');
      setSettingsPassError(null);
    } else {
      playSoundEffect('error');
      setSettingsPassError('كلمة مرور الإعدادات غير صحيحة.');
    }
  };

  if (!unlocked) {
    return (
      <PasscodeLockScreen
        businessName={store.settings.business_name}
        branchName={store.settings.branch_name}
        expectedPasscode={store.settings.access_passcode}
        onUnlock={handleUnlock}
      />
    );
  }

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'لوحة العمليات', icon: LayoutDashboard },
    { id: 'pos', label: 'نقطة البيع (POS)', icon: ShoppingCart },
    { id: 'invoices', label: 'سجل الفواتير', icon: Receipt },
    { id: 'inventory', label: 'المخزن والتسعير', icon: Package },
    { id: 'staff', label: 'طاقم العمل', icon: Users },
    { id: 'database', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#EEF3F9] text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Navigation (Fixed Viewport Height, Collapsible on Desktop & Drawer on Mobile) */}
      <aside
        className={`no-print fixed inset-y-0 right-0 z-40 h-full lg:h-screen lg:shrink-0 overflow-y-auto bg-gradient-to-b from-[#E6F0FD] via-[#EDF4FE] to-[#E2ECFB] border-l border-blue-200/90 shadow-md lg:shadow-sm flex flex-col justify-between transition-all duration-200 lg:static lg:translate-x-0 ${
          sidebarCollapsed ? 'w-64 lg:w-[74px]' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div>
          <div className="h-14 px-3 border-b border-blue-200/80 flex items-center justify-between gap-2 sticky top-0 bg-[#E6F0FD]/95 backdrop-blur-xs z-10">
            <div
              className={`flex items-center gap-2.5 min-w-0 ${
                sidebarCollapsed ? 'lg:justify-center lg:w-full' : ''
              }`}
            >
              <BrandLogo size="sm" className="btn-sheen" />
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <div className="font-bold text-slate-900 text-sm truncate leading-tight">
                  {store.settings.business_name}
                </div>
                <div className="text-[10px] text-blue-800/80 truncate">
                  {store.settings.address || store.settings.branch_name}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
              aria-label={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
              className="hidden lg:flex p-1.5 rounded-lg text-blue-700 hover:bg-white/80 hover:text-blue-900 border border-transparent hover:border-blue-200 transition-all shrink-0"
            >
              {sidebarCollapsed ? (
                <PanelRightOpen className="w-4 h-4" />
              ) : (
                <PanelRightClose className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-blue-100"
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-2.5 space-y-1.5" aria-label="التنقل الرئيسي">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => navigateTab(item.id)}
                  className={`group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                    sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    isActive
                      ? 'bg-white text-blue-800 font-bold border-blue-300 shadow-sm ring-2 ring-blue-500/15'
                      : 'text-slate-700 border-transparent hover:bg-white/75 hover:border-blue-200 hover:text-blue-800 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                        isActive
                          ? 'text-blue-700 scale-105'
                          : 'text-blue-600/80 group-hover:text-blue-700 group-hover:scale-110'
                      }`}
                    />
                    <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                  </div>
                  {!sidebarCollapsed && (
                    <ChevronLeft
                      className={`w-3.5 h-3.5 shrink-0 transition-all ${
                        isActive
                          ? 'text-blue-700 opacity-100'
                          : 'text-blue-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-blue-200/80 space-y-2.5">
          {!sidebarCollapsed ? (
            <div className="text-[11px] text-slate-700 bg-white/70 border border-blue-200/80 rounded-xl p-2.5 shadow-xs space-y-1">
              <div className="font-bold text-slate-900 truncate">
                {store.settings.branch_name}
              </div>
              <div>
                ضريبة القيمة المضافة:{' '}
                <strong className="font-mono-num text-blue-800">
                  {store.settings.vat_rate}%
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className={store.supabaseConnected ? 'text-emerald-800 font-semibold' : ''}>
                  {store.supabaseConnected ? 'متصل بـ Supabase' : 'تخزين محلي تجريبي'}
                </span>
                {store.supabaseConnected && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await store.syncFromSupabase();
                      if (ok) {
                        notify('تم التحديث من Supabase', 'تم جلب أحدث البيانات بنجاح.', 'info', 'sync');
                      } else {
                        notify('تعذر المزامنة', 'تحقق من اتصال Supabase أو الصلاحيات.', 'warning', 'error');
                      }
                    }}
                    disabled={store.syncing}
                    title="جلب أحدث البيانات من Supabase"
                    className="group text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 transition-transform ${
                        store.syncing ? 'animate-spin' : 'group-hover:rotate-90'
                      }`}
                    />
                    <span>تحديث</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            store.supabaseConnected && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await store.syncFromSupabase();
                  if (ok) {
                    notify('تم التحديث من Supabase', 'تم جلب أحدث البيانات بنجاح.', 'info', 'sync');
                  }
                }}
                disabled={store.syncing}
                title="تحديث البيانات من Supabase"
                className="w-full h-9 rounded-xl border border-blue-200 bg-white/85 hover:bg-white text-blue-700 flex items-center justify-center shadow-xs transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${store.syncing ? 'animate-spin' : ''}`} />
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleLock}
            title="قفل شاشة النظام"
            className="group w-full h-9 px-3 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-xs font-semibold text-blue-800 flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Lock className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>قفل شاشة النظام</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area (Fixed Frame with Inner Scroll) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        {/* Clean Top Header Bar */}
        <header className="no-print h-14 shrink-0 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-xs px-4 md:px-6 flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="فتح القائمة"
              className="lg:hidden p-1.5 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100"
            >
              <Menu className="w-4 h-4" />
            </button>
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                title="إظهار القائمة الجانبية الكاملة"
                className="hidden lg:inline-flex p-1.5 rounded-lg border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-slate-600 font-semibold hidden sm:inline truncate">
                {store.settings.business_name}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-sm text-slate-900 truncate">
                {TAB_LABELS[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
              aria-label={soundEnabled ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
              className={`group h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                soundEnabled
                  ? 'bg-sky-50 border-sky-200 text-blue-700 hover:bg-sky-100 shadow-xs'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'الصوت مفعل' : 'صامت'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPos('service')}
              className="group btn-sheen px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Receipt className="w-3.5 h-3.5 transition-transform group-hover:-rotate-6" />
              <span>إصدار فاتورة سريعة</span>
            </button>
          </div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="no-print flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1400px] w-full mx-auto">
          {store.syncError && activeTab !== 'database' && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 shadow-xs text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>تنبيه المزامنة: {store.syncError}</span>
              </div>
              <button
                type="button"
                onClick={() => navigateTab('database')}
                className="font-bold text-blue-700 hover:text-blue-900 underline shrink-0"
              >
                فحص الإعدادات
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={store.invoices}
              products={store.products}
              staff={store.staff}
              onOpenPos={handleOpenPos}
              onUpdateStatus={async (id: string, status: InvoiceStatus) => {
                await store.updateInvoiceStatus(id, status);
                notify(
                  'تم تحديث حالة السيارة',
                  `أصبحت الحالة الحالية: ${INVOICE_STATUS_LABELS[status]}`,
                  'success',
                  'success'
                );
              }}
              onPreviewInvoice={(inv) => {
                playSoundEffect('click');
                setPreviewInvoice(inv);
              }}
              onNavigateTab={(tab) => navigateTab(tab)}
            />
          )}

          {activeTab === 'pos' && (
            <PosView
              key={posInitialMode}
              initialMode={posInitialMode}
              services={store.services}
              products={store.products}
              staff={store.staff}
              customers={store.customers}
              vatRate={store.settings.vat_rate}
              onCreateInvoice={async (payload) => {
                const inv = await store.createInvoice(payload);
                notify(
                  `تم إصدار الفاتورة ${inv.invoice_number}`,
                  inv.invoice_type === 'service'
                    ? `فاتورة خدمات غسيل للعميل ${inv.customer_name}`
                    : `فاتورة بيع منتجات منفردة (${inv.items.length} صنف)`,
                  'success',
                  'invoice'
                );
                return inv;
              }}
              onInvoiceCreated={(inv) => setPreviewInvoice(inv)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesLedgerView
              invoices={store.invoices}
              staff={store.staff}
              onPreviewInvoice={(inv) => {
                playSoundEffect('click');
                setPreviewInvoice(inv);
              }}
              onUpdateStatus={async (id: string, status: InvoiceStatus) => {
                await store.updateInvoiceStatus(id, status);
                notify(
                  'تم تحديث حالة الفاتورة',
                  `الحالة الجديدة: ${INVOICE_STATUS_LABELS[status]}`,
                  'success',
                  'success'
                );
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPricingView
              products={store.products}
              services={store.services}
              staff={store.staff}
              stockMovements={store.stockMovements}
              vatRate={store.settings.vat_rate}
              onUpsertProduct={async (data) => {
                await store.upsertProduct(data);
                notify(
                  data.id ? 'تم تحديث المنتج' : 'تمت إضافة منتج جديد',
                  `${data.name_ar} · سعر البيع: ${data.selling_price} ج.م`,
                  'success',
                  'success'
                );
              }}
              onAdjustStock={async (params) => {
                await store.adjustProductStock(params);
                notify(
                  'تم تسجيل حركة المخزن',
                  'تم تحديث الكمية المتوفرة بالمخزن بنجاح.',
                  'info',
                  'success'
                );
              }}
              onUpsertService={async (data) => {
                await store.upsertService(data);
                notify(
                  data.id ? 'تم تحديث خدمة الغسيل' : 'تمت إضافة خدمة غسيل جديدة',
                  data.name_ar,
                  'success',
                  'success'
                );
              }}
            />
          )}

          {activeTab === 'staff' && (
            <StaffView
              staff={store.staff}
              invoices={store.invoices}
              onUpsertStaff={async (data) => {
                await store.upsertStaff(data);
                notify(
                  data.id ? 'تم تحديث بيانات الموظف' : 'تمت إضافة موظف جديد',
                  data.full_name,
                  'success',
                  'success'
                );
              }}
            />
          )}

          {activeTab === 'database' &&
            (!settingsUnlocked ? (
              <div className="min-h-[60vh] flex items-center justify-center p-4">
                <form
                  onSubmit={handleUnlockSettings}
                  className="w-full max-w-sm bg-sky-50/90 border border-blue-200 rounded-2xl p-6 space-y-4 shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-700 text-white shadow-sm flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        إعدادات الإدارة المحمية
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        هذا القسم مخصص للمدير فقط. أدخل كلمة المرور الخاصة بالإعدادات.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="settings-passcode"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      كلمة مرور الإعدادات
                    </label>
                    <input
                      id="settings-passcode"
                      name="settings-passcode"
                      type="password"
                      autoComplete="current-password"
                      dir="ltr"
                      autoFocus
                      value={settingsPassInput}
                      onChange={(e) => {
                        setSettingsPassInput(e.target.value);
                        if (settingsPassError) setSettingsPassError(null);
                      }}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 rounded-xl border border-blue-200 bg-white text-sm tracking-widest font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {settingsPassError && (
                    <p className="text-xs font-medium text-red-600" role="alert">
                      {settingsPassError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-sheen w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    فتح الإعدادات
                  </button>
                </form>
              </div>
            ) : (
              <DatabaseSettingsView
                settings={store.settings}
                supabaseConnected={store.supabaseConnected}
                syncing={store.syncing}
                syncError={store.syncError}
                onUpdateSettings={async (patch) => {
                  await store.updateSettings(patch);
                  notify('تم حفظ الإعدادات', 'تم تطبيق إعدادات النشاط والضريبة بنجاح.', 'success', 'success');
                }}
                onSyncSupabase={async () => {
                  const ok = await store.syncFromSupabase();
                  if (ok) {
                    notify('اكتملت المزامنة', 'تم جلب أحدث البيانات من Supabase.', 'info', 'sync');
                  } else {
                    notify('تنبيه اتصال', 'تحقق من إعدادات Supabase وصلاحيات الجداول.', 'warning', 'error');
                  }
                  return ok;
                }}
                onPushToSupabase={async () => {
                  const res = await store.pushLocalDataToSupabase();
                  if (res.ok) {
                    notify('اكتمل الترحيل إلى Supabase', res.message, 'success', 'sync');
                  } else {
                    notify('تعذر الترحيل', res.message, 'warning', 'error');
                  }
                  return res;
                }}
                onResetDemoData={() => {
                  store.resetDemoData();
                  notify('تمت الاستعادة', 'تمت استعادة البيانات الافتراضية محلياً.', 'info', 'success');
                }}
                onLockSettings={() => {
                  playSoundEffect('click');
                  setSettingsUnlocked(false);
                }}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Floating Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="no-print fixed bottom-5 left-5 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100%-2.5rem)] pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`animate-toast-in pointer-events-auto rounded-xl border p-3.5 shadow-lg flex items-start gap-3 ${
                toast.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : toast.tone === 'warning'
                  ? 'bg-orange-50 border-orange-300 text-orange-950'
                  : 'bg-sky-50 border-blue-300 text-slate-900'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  toast.tone === 'success'
                    ? 'bg-emerald-600 text-white'
                    : toast.tone === 'warning'
                    ? 'bg-orange-600 text-white'
                    : 'bg-blue-700 text-white'
                }`}
              >
                {toast.tone === 'warning' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : toast.tone === 'info' ? (
                  <Info className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold">{toast.title}</div>
                {toast.description && (
                  <div className="text-[11px] opacity-85 mt-0.5 leading-snug">
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="إغلاق الإشعار"
                className="p-1 rounded-md hover:bg-black/5 text-slate-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Printable Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePrintModal
          invoice={previewInvoice}
          settings={store.settings}
          staff={store.staff}
          onClose={() => {
            playSoundEffect('click');
            setPreviewInvoice(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
