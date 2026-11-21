import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Info,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { DashboardView } from './components/DashboardView';
import { DatabaseSettingsView } from './components/DatabaseSettingsView';
import { InventoryPricingView } from './components/InventoryPricingView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { InvoicesLedgerView } from './components/InvoicesLedgerView';
import { PartiesWalletsView } from './components/PartiesWalletsView';
import { PasscodeLockScreen } from './components/PasscodeLockScreen';
import { PosView } from './components/PosView';
import { PurchasesExpensesView } from './components/PurchasesExpensesView';
import { ReportsCenterView } from './components/ReportsCenterView';
import { ShiftsAuditView } from './components/ShiftsAuditView';
import { StaffView } from './components/StaffView';
import { useCarWashStore } from './store/useCarWashStore';
import { AppThemeId, Invoice, InvoiceStatus, InvoiceType } from './types/carwash';
import {
  isSoundEnabled,
  playSoundEffect,
  setSoundEnabledPref,
  SoundEffectType,
} from './utils/feedback';
import { INVOICE_STATUS_LABELS, THEME_OPTIONS } from './utils/pricing';

type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'invoices'
  | 'inventory'
  | 'purchases'
  | 'parties'
  | 'shifts'
  | 'reports'
  | 'staff'
  | 'database';

const TAB_LABELS: Record<ActiveTab, string> = {
  dashboard: 'لوحة العمليات اليومية',
  pos: 'كاشير الغسيل والمبيعات',
  invoices: 'سجل الفواتير والطباعة',
  inventory: 'المخزن والتسعير والباركود',
  purchases: 'المشتريات والمصروفات النثرية',
  parties: 'العملاء والموردين والمحافظ',
  shifts: 'الورديات ومراجعة اليومية',
  reports: 'مركز التقارير والأرباح والخسائر',
  staff: 'طاقم العمل والصلاحيات والرواتب',
  database: 'الإعدادات والنسخ الاحتياطي',
};

const THEME_CLASSES: Record<
  AppThemeId,
  {
    canvas: string;
    sidebar: string;
    sidebarHeader: string;
    sidebarBorder: string;
    header: string;
    isDarkSidebar: boolean;
  }
> = {
  'royal-blue': {
    canvas: 'bg-[#EEF3F9]',
    sidebar: 'bg-gradient-to-b from-[#E6F0FD] via-[#EDF4FE] to-[#E2ECFB]',
    sidebarHeader: 'bg-[#E6F0FD]/95',
    sidebarBorder: 'border-blue-200/90',
    header: 'bg-white/95',
    isDarkSidebar: false,
  },
  'emerald-mint': {
    canvas: 'bg-[#ECFDF5]',
    sidebar: 'bg-gradient-to-b from-[#D1FAE5] via-[#E6F9F2] to-[#E0F2FE]',
    sidebarHeader: 'bg-[#D1FAE5]/95',
    sidebarBorder: 'border-emerald-200/90',
    header: 'bg-white/95',
    isDarkSidebar: false,
  },
  'warm-sand': {
    canvas: 'bg-[#F8F4EE]',
    sidebar: 'bg-gradient-to-b from-[#F3EAD8] via-[#F7F1E3] to-[#EFE4CE]',
    sidebarHeader: 'bg-[#F3EAD8]/95',
    sidebarBorder: 'border-amber-200/90',
    header: 'bg-[#FFFCF7]/95',
    isDarkSidebar: false,
  },
  'sunset-coral': {
    canvas: 'bg-[#FFF5F0]',
    sidebar: 'bg-gradient-to-b from-[#FFEDD5] via-[#FFF1E6] to-[#FFE4E6]',
    sidebarHeader: 'bg-[#FFEDD5]/95',
    sidebarBorder: 'border-orange-200/90',
    header: 'bg-white/95',
    isDarkSidebar: false,
  },
  'slate-dark': {
    canvas: 'bg-slate-200',
    sidebar: 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
    sidebarHeader: 'bg-slate-900/95',
    sidebarBorder: 'border-slate-700',
    header: 'bg-slate-50/95',
    isDarkSidebar: true,
  },
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

  const perms = store.effectivePermissions;
  const activeThemeId = (store.settings.theme || 'royal-blue') as AppThemeId;
  const themeStyle = THEME_CLASSES[activeThemeId] || THEME_CLASSES['royal-blue'];

  const lowStockCount = useMemo(
    () => store.products.filter((p) => p.stock_qty <= p.min_stock_alert).length,
    [store.products]
  );

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

  const canAccessTab = useCallback(
    (tab: ActiveTab): boolean => {
      switch (tab) {
        case 'pos':
          return perms.can_access_pos;
        case 'inventory':
          return perms.can_manage_inventory;
        case 'purchases':
          return perms.can_manage_purchases || perms.can_manage_expenses;
        case 'shifts':
          return perms.can_close_shift || perms.can_view_reports;
        case 'reports':
          return perms.can_view_reports;
        case 'database':
          return perms.can_manage_settings;
        default:
          return true;
      }
    },
    [perms]
  );

  const navigateTab = (tab: ActiveTab) => {
    if (!canAccessTab(tab)) {
      notify(
        'صلاحية غير متاحة',
        `المستخدم الحالي (${store.activeStaff?.full_name || 'الكاشير'}) لا يملك صلاحية فتح "${TAB_LABELS[tab]}".`,
        'warning',
        'error'
      );
      return;
    }
    playSoundEffect('click');
    if (tab !== 'database') {
      setSettingsUnlocked(false);
      setSettingsPassInput('');
      setSettingsPassError(null);
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSwitchActiveStaff = (staffId: string) => {
    playSoundEffect('click');
    store.setActiveStaffId(staffId);
    setSettingsUnlocked(false);
    setSettingsPassInput('');
    const nextMember = store.staff.find((s) => s.id === staffId);
    if (nextMember) {
      notify(
        'تم تبديل المستخدم النشط',
        `تعمل الآن بصلاحيات: ${nextMember.full_name} (${nextMember.role_title_ar})`,
        'info',
        'click'
      );
      setActiveTab('dashboard');
    }
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
    badge?: number;
  }> = (
    [
      { id: 'dashboard', label: 'لوحة العمليات', icon: LayoutDashboard },
      { id: 'pos', label: 'نقطة البيع (POS)', icon: ShoppingCart },
      { id: 'invoices', label: 'سجل الفواتير', icon: Receipt },
      { id: 'inventory', label: 'المخزن والتسعير', icon: Package, badge: lowStockCount },
      { id: 'purchases', label: 'المشتريات والمصروفات', icon: ShoppingBag },
      { id: 'parties', label: 'العملاء والموردين والمحافظ', icon: Wallet },
      { id: 'shifts', label: 'الورديات واليومية', icon: Clock },
      { id: 'reports', label: 'التقارير والأرباح', icon: BarChart3 },
      { id: 'staff', label: 'طاقم العمل والرواتب', icon: Users },
      { id: 'database', label: 'الإعدادات', icon: Settings },
    ] satisfies Array<{
      id: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
    }>
  ).filter((item) => canAccessTab(item.id));

  const darkSide = themeStyle.isDarkSidebar;

  return (
    <div
      className={`h-screen overflow-hidden ${themeStyle.canvas} text-slate-900 flex flex-col lg:flex-row transition-colors duration-200`}
    >
      {/* Sidebar Navigation (Fixed Viewport Height, Collapsible on Desktop & Drawer on Mobile) */}
      <aside
        className={`no-print fixed inset-y-0 right-0 z-40 h-full lg:h-screen lg:shrink-0 overflow-y-auto ${themeStyle.sidebar} border-l ${themeStyle.sidebarBorder} shadow-md lg:shadow-sm flex flex-col justify-between transition-all duration-200 lg:static lg:translate-x-0 ${
          sidebarCollapsed ? 'w-64 lg:w-[74px]' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div>
          <div
            className={`h-14 px-3 border-b ${themeStyle.sidebarBorder} flex items-center justify-between gap-2 sticky top-0 ${themeStyle.sidebarHeader} backdrop-blur-xs z-10`}
          >
            <div
              className={`flex items-center gap-2.5 min-w-0 ${
                sidebarCollapsed ? 'lg:justify-center lg:w-full' : ''
              }`}
            >
              <BrandLogo size="sm" className="btn-sheen" />
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <div
                  className={`font-bold text-sm truncate leading-tight ${
                    darkSide ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {store.settings.business_name}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    darkSide ? 'text-sky-300' : 'text-blue-800/80'
                  }`}
                >
                  {store.settings.address || store.settings.branch_name}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
              aria-label={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
              className={`hidden lg:flex p-1.5 rounded-lg border border-transparent transition-all shrink-0 ${
                darkSide
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'text-blue-700 hover:bg-white/80 hover:text-blue-900 hover:border-blue-200'
              }`}
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
              className={`lg:hidden p-1.5 rounded-md ${
                darkSide
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-blue-100'
              }`}
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-2.5 space-y-1" aria-label="التنقل الرئيسي">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => navigateTab(item.id)}
                  className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                    sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    isActive
                      ? darkSide
                        ? 'bg-blue-700 text-white font-bold border-blue-500 shadow-sm'
                        : 'bg-white text-blue-800 font-bold border-blue-300 shadow-sm ring-2 ring-blue-500/15'
                      : darkSide
                      ? 'text-slate-200 border-transparent hover:bg-slate-800 hover:text-white'
                      : 'text-slate-700 border-transparent hover:bg-white/75 hover:border-blue-200 hover:text-blue-800 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                        isActive
                          ? darkSide
                            ? 'text-white scale-105'
                            : 'text-blue-700 scale-105'
                          : darkSide
                          ? 'text-sky-300 group-hover:text-white group-hover:scale-110'
                          : 'text-blue-600/80 group-hover:text-blue-700 group-hover:scale-110'
                      }`}
                    />
                    <span className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-1 shrink-0">
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono-num font-bold leading-none">
                          {item.badge}
                        </span>
                      )}
                      <ChevronLeft
                        className={`w-3.5 h-3.5 transition-all ${
                          isActive
                            ? darkSide
                              ? 'text-white opacity-100'
                              : 'text-blue-700 opacity-100'
                            : 'text-blue-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                        }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`p-3 border-t ${themeStyle.sidebarBorder} space-y-2`}>
          {!sidebarCollapsed ? (
            <div
              className={`text-[11px] rounded-xl p-2.5 shadow-xs space-y-1 border ${
                darkSide
                  ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                  : 'bg-white/75 border-blue-200/80 text-slate-700'
              }`}
            >
              <div className={`font-bold truncate ${darkSide ? 'text-white' : 'text-slate-900'}`}>
                {store.settings.branch_name}
              </div>
              <div>
                ضريبة القيمة المضافة:{' '}
                <strong
                  className={`font-mono-num ${darkSide ? 'text-sky-300' : 'text-blue-800'}`}
                >
                  {store.settings.vat_rate}%
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span
                  className={
                    store.supabaseConnected
                      ? darkSide
                        ? 'text-emerald-400 font-semibold'
                        : 'text-emerald-800 font-semibold'
                      : ''
                  }
                >
                  {store.supabaseConnected ? 'متصل بـ Supabase' : 'تخزين محلي'}
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
                    className={`group font-bold flex items-center gap-1 disabled:opacity-50 ${
                      darkSide ? 'text-sky-300 hover:text-white' : 'text-blue-700 hover:text-blue-900'
                    }`}
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
            className={`group w-full h-9 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all ${
              darkSide
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                : 'border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-800'
            }`}
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
        <header
          className={`no-print h-14 shrink-0 ${themeStyle.header} backdrop-blur-xs border-b border-slate-200/90 shadow-xs px-3 md:px-5 flex items-center justify-between gap-3 z-20`}
        >
          <div className="flex items-center gap-2 min-w-0">
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
              <span className="text-slate-600 font-semibold hidden xl:inline truncate">
                {store.settings.business_name}
              </span>
              <span className="text-slate-300 hidden xl:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-sm text-slate-900 truncate">
                {TAB_LABELS[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Active Cashier / User Switcher */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-8">
              <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <select
                aria-label="تبديل المستخدم أو الكاشير النشط"
                value={store.activeStaffId}
                onChange={(e) => handleSwitchActiveStaff(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none max-w-[140px]"
              >
                {store.staff.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role_title_ar})
                  </option>
                ))}
              </select>
            </div>

            {/* Low-Stock Alert Counter */}
            {lowStockCount > 0 && canAccessTab('inventory') && (
              <button
                type="button"
                onClick={() => navigateTab('inventory')}
                title={`يوجد ${lowStockCount} صنف وصل للحد الأدنى`}
                className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-mono-num">{lowStockCount}</span>
                <span className="hidden lg:inline">نواقص</span>
              </button>
            )}

            {/* Quick Theme Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-8">
              <Palette className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <select
                aria-label="تغيير ثيم وألوان النظام"
                value={activeThemeId}
                onChange={(e) => {
                  playSoundEffect('click');
                  store.updateSettings({ theme: e.target.value as AppThemeId });
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

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
              <span className="hidden xl:inline">{soundEnabled ? 'الصوت' : 'صامت'}</span>
            </button>

            {perms.can_access_pos && (
              <button
                type="button"
                onClick={() => handleOpenPos('service')}
                className="group btn-sheen px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Receipt className="w-3.5 h-3.5 transition-transform group-hover:-rotate-6" />
                <span>فاتورة سريعة</span>
              </button>
            )}
          </div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="no-print flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1440px] w-full mx-auto">
            {store.syncError && activeTab !== 'database' && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 shadow-xs text-xs text-amber-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>تنبيه المزامنة: {store.syncError}</span>
                </div>
                {canAccessTab('database') && (
                  <button
                    type="button"
                    onClick={() => navigateTab('database')}
                    className="font-bold text-blue-700 hover:text-blue-900 underline shrink-0"
                  >
                    فحص الإعدادات
                  </button>
                )}
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                invoices={store.invoices}
                products={store.products}
                staff={store.staff}
                wallets={store.wallets}
                currentOpenShift={store.currentOpenShift}
                canViewProfits={perms.can_view_profits}
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
                key={`${posInitialMode}-${store.activeStaffId}`}
                initialMode={posInitialMode}
                services={store.services}
                products={store.products}
                staff={store.staff}
                customers={store.customers}
                wallets={store.wallets}
                vatRate={store.settings.vat_rate}
                defaultCashierId={store.activeStaffId}
                canApplyDiscount={perms.can_apply_discount}
                canSellWholesale={perms.can_sell_wholesale}
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
                wallets={store.wallets}
                canViewProfits={perms.can_view_profits}
                canExportExcel={perms.can_export_excel}
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
                businessName={store.settings.business_name}
                canViewProfits={perms.can_view_profits}
                canExportExcel={perms.can_export_excel}
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

            {activeTab === 'purchases' && store.activeStaff && (
              <PurchasesExpensesView
                purchases={store.purchases}
                expenses={store.expenses}
                products={store.products}
                suppliers={store.suppliers}
                wallets={store.wallets}
                activeStaff={store.activeStaff}
                canManagePurchases={perms.can_manage_purchases}
                canManageExpenses={perms.can_manage_expenses}
                canExportExcel={perms.can_export_excel}
                onCreatePurchase={async (payload) => {
                  const po = await store.createPurchaseOrder(payload);
                  notify(
                    `تم تسجيل فاتورة مشتريات ${po.purchase_number}`,
                    `المورد: ${po.supplier_name} · الإجمالي: ${po.total_amount} ج.م`,
                    'success',
                    'success'
                  );
                  return po;
                }}
                onAddExpense={async (params) => {
                  await store.addExpense(params);
                  notify(
                    'تم تسجيل المصروف النثري',
                    `${params.title} (${params.amount} ج.م)`,
                    'info',
                    'success'
                  );
                }}
                onDeleteExpense={async (id) => {
                  await store.deleteExpense(id);
                  notify('تم حذف المصروف', 'تم تحديث سجل المصروفات النثرية.', 'info', 'click');
                }}
              />
            )}

            {activeTab === 'parties' && store.activeStaff && (
              <PartiesWalletsView
                customers={store.customers}
                suppliers={store.suppliers}
                wallets={store.wallets}
                invoices={store.invoices}
                purchases={store.purchases}
                partyPayments={store.partyPayments}
                activeStaff={store.activeStaff}
                canExportExcel={perms.can_export_excel}
                onUpsertCustomer={async (data) => {
                  await store.upsertCustomer(data);
                  notify('تم حفظ بيانات العميل', data.full_name, 'success', 'success');
                }}
                onUpsertSupplier={async (data) => {
                  await store.upsertSupplier(data);
                  notify('تم حفظ بيانات المورد', data.name, 'success', 'success');
                }}
                onUpsertWallet={async (data) => {
                  await store.upsertWallet(data);
                  notify('تم حفظ المحفظة الإلكترونية', data.name, 'success', 'success');
                }}
                onDeleteWallet={async (id) => {
                  await store.deleteWallet(id);
                  notify('تم حذف المحفظة', 'تم تحديث قائمة المحافظ الإلكترونية.', 'info', 'click');
                }}
                onRecordPartyPayment={async (params) => {
                  await store.recordPartyPayment(params);
                  notify(
                    params.party_type === 'customer' ? 'تم تحصيل دفعة من عميل' : 'تم سداد دفعة لمورد',
                    `${params.party_name} · ${params.amount} ج.م`,
                    'success',
                    'success'
                  );
                }}
              />
            )}

            {activeTab === 'shifts' && store.activeStaff && (
              <ShiftsAuditView
                shifts={store.shifts}
                activeStaff={store.activeStaff}
                canCloseShift={perms.can_close_shift}
                canExportExcel={perms.can_export_excel}
                businessName={store.settings.business_name}
                onOpenShift={async (params) => {
                  const sh = await store.openShift(params);
                  notify(
                    `تم فتح الوردية ${sh.shift_number}`,
                    `عهدة الافتتاح: ${sh.opening_cash} ج.م`,
                    'success',
                    'success'
                  );
                  return sh;
                }}
                onCloseShift={async (params) => {
                  await store.closeShift(params);
                  notify(
                    'تم إغلاق وترحيل الوردية',
                    'تم حفظ تقرير العجز والزيادة في سجل الورديات.',
                    'success',
                    'success'
                  );
                }}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsCenterView
                invoices={store.invoices}
                purchases={store.purchases}
                products={store.products}
                expenses={store.expenses}
                customers={store.customers}
                suppliers={store.suppliers}
                partyPayments={store.partyPayments}
                staff={store.staff}
                payrollPayouts={store.payrollPayouts}
                wallets={store.wallets}
                canViewProfits={perms.can_view_profits}
                canExportExcel={perms.can_export_excel}
              />
            )}

            {activeTab === 'staff' && (
              <StaffView
                staff={store.staff}
                invoices={store.invoices}
                payrollPayouts={store.payrollPayouts}
                wallets={store.wallets}
                canExportExcel={perms.can_export_excel}
                onUpsertStaff={async (data) => {
                  await store.upsertStaff(data);
                  notify(
                    data.id ? 'تم تحديث بيانات الموظف' : 'تمت إضافة موظف جديد',
                    data.full_name,
                    'success',
                    'success'
                  );
                }}
                onRecordPayroll={async (params) => {
                  await store.recordPayrollPayout(params);
                  notify(
                    'تم صرف الراتب بنجاح',
                    `${params.staff_name} · الصافي: ${params.net_paid} ج.م`,
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
                  backups={store.backups}
                  supabaseConnected={store.supabaseConnected}
                  syncing={store.syncing}
                  syncError={store.syncError}
                  onUpdateSettings={async (patch) => {
                    await store.updateSettings(patch);
                    notify('تم حفظ الإعدادات', 'تم تطبيق إعدادات النشاط بنجاح.', 'success', 'success');
                  }}
                  onCreateBackup={(kind) => {
                    const entry = store.createBackup(kind || 'manual');
                    notify('تم حفظ النسخة الاحتياطية', entry.summary, 'success', 'success');
                    return entry;
                  }}
                  onRestoreBackup={(raw) => {
                    const res = store.restoreBackup(raw);
                    notify(
                      res.ok ? 'تمت استعادة البيانات' : 'تعذر الاستعادة',
                      res.message,
                      res.ok ? 'success' : 'warning',
                      res.ok ? 'success' : 'error'
                    );
                    return res;
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
          wallets={store.wallets}
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
