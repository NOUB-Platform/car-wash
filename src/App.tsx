import React, { useState } from 'react';
import {
  AlertCircle,
  CarFront,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { DatabaseSettingsView } from './components/DatabaseSettingsView';
import { InventoryPricingView } from './components/InventoryPricingView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { InvoicesLedgerView } from './components/InvoicesLedgerView';
import { PasscodeLockScreen } from './components/PasscodeLockScreen';
import { PosView } from './components/PosView';
import { StaffView } from './components/StaffView';
import { useCarWashStore } from './store/useCarWashStore';
import { Invoice, InvoiceType } from './types/carwash';

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
const SETTINGS_PASSCODE = '87654321';

export function App() {
  const store = useCarWashStore();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_UNLOCK_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [posInitialMode, setPosInitialMode] = useState<InvoiceType>('service');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings security gate state (auto-locks when navigating away)
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPassInput, setSettingsPassInput] = useState('');
  const [settingsPassError, setSettingsPassError] = useState<string | null>(null);

  const navigateTab = (tab: ActiveTab) => {
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
    setUnlocked(true);
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    } catch {
      // Ignore storage error
    }
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
      setSettingsUnlocked(true);
      setSettingsPassInput('');
      setSettingsPassError(null);
    } else {
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside
        className={`no-print fixed inset-y-0 right-0 z-40 w-64 bg-[#EFF6FF] border-l border-blue-200/80 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="h-14 px-4 border-b border-blue-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                <CarFront className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm truncate">
                ووش كير
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-blue-100"
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
                  onClick={() => navigateTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-blue-800 font-bold border border-blue-200 shadow-xs'
                      : 'text-slate-700 hover:bg-blue-100/70 hover:text-blue-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-blue-600/70'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 border-t border-blue-200/80 space-y-2.5">
          <div className="text-[11px] text-slate-600 space-y-0.5">
            <div className="font-semibold text-slate-800 truncate">
              {store.settings.branch_name}
            </div>
            <div>
              ضريبة القيمة المضافة: <strong className="font-mono-num">{store.settings.vat_rate}%</strong>
            </div>
            <div>
              المخزن: {store.supabaseConnected ? 'متصل بـ Supabase' : 'تخزين محلي تجريبي'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLock}
            className="w-full h-8 px-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>قفل شاشة النظام</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Header Bar */}
        <header className="no-print h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="فتح القائمة"
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-slate-400 hidden sm:inline truncate">
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

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenPos('service')}
              className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              إصدار فاتورة سريعة
            </button>
          </div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="no-print flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          {store.syncError && activeTab !== 'database' && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>تنبيه المزامنة: {store.syncError}</span>
              </div>
              <button
                type="button"
                onClick={() => navigateTab('database')}
                className="font-bold text-amber-800 underline shrink-0"
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
              onUpdateStatus={(id, status) => store.updateInvoiceStatus(id, status)}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
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
              onCreateInvoice={store.createInvoice}
              onInvoiceCreated={(inv) => setPreviewInvoice(inv)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesLedgerView
              invoices={store.invoices}
              staff={store.staff}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
              onUpdateStatus={(id, status) => store.updateInvoiceStatus(id, status)}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPricingView
              products={store.products}
              services={store.services}
              staff={store.staff}
              stockMovements={store.stockMovements}
              vatRate={store.settings.vat_rate}
              onUpsertProduct={store.upsertProduct}
              onAdjustStock={store.adjustProductStock}
              onUpsertService={store.upsertService}
            />
          )}

          {activeTab === 'staff' && (
            <StaffView
              staff={store.staff}
              invoices={store.invoices}
              onUpsertStaff={store.upsertStaff}
            />
          )}

          {activeTab === 'database' &&
            (!settingsUnlocked ? (
              <div className="min-h-[60vh] flex items-center justify-center p-4">
                <form
                  onSubmit={handleUnlockSettings}
                  className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        إعدادات الإدارة المحمية
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
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
                      type="password"
                      dir="ltr"
                      autoFocus
                      value={settingsPassInput}
                      onChange={(e) => {
                        setSettingsPassInput(e.target.value);
                        if (settingsPassError) setSettingsPassError(null);
                      }}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tracking-widest font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {settingsPassError && (
                    <p className="text-xs font-medium text-red-600" role="alert">
                      {settingsPassError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
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
                onUpdateSettings={store.updateSettings}
                onSyncSupabase={store.syncFromSupabase}
                onPushToSupabase={store.pushLocalDataToSupabase}
                onResetDemoData={store.resetDemoData}
                onLockSettings={() => setSettingsUnlocked(false)}
              />
            ))}
        </main>
      </div>

      {/* Printable Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePrintModal
          invoice={previewInvoice}
          settings={store.settings}
          staff={store.staff}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}

export default App;
