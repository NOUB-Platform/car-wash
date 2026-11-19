import React, { useState } from 'react';
import {
  CarFront,
  Database,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  Receipt,
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
  database: 'Supabase والإعدادات',
};

const SESSION_UNLOCK_KEY = 'naqaa_terminal_unlocked';

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
    setUnlocked(false);
  };

  const handleOpenPos = (mode: InvoiceType) => {
    setPosInitialMode(mode);
    setActiveTab('pos');
    setMobileMenuOpen(false);
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
    { id: 'database', label: 'قاعدة البيانات SQL', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside
        className={`no-print fixed inset-y-0 right-0 z-40 w-64 bg-white border-l border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
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
              className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
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
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 border-t border-slate-200 space-y-2.5">
          <div className="text-[11px] text-slate-500 space-y-0.5">
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
            className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
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
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={store.invoices}
              products={store.products}
              staff={store.staff}
              onOpenPos={handleOpenPos}
              onUpdateStatus={(id, status) => store.updateInvoiceStatus(id, status)}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
              onNavigateTab={(tab) => setActiveTab(tab)}
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

          {activeTab === 'database' && (
            <DatabaseSettingsView
              settings={store.settings}
              supabaseConnected={store.supabaseConnected}
              syncing={store.syncing}
              syncError={store.syncError}
              onUpdateSettings={store.updateSettings}
              onSyncSupabase={store.syncFromSupabase}
              onResetDemoData={store.resetDemoData}
            />
          )}
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
