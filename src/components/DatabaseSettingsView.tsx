import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  RotateCcw,
  Shield,
  UploadCloud,
} from 'lucide-react';
import schemaSql from '../../supabase/schema.sql?raw';
import {
  clearSupabaseConfig,
  getSavedSupabaseConfig,
  normalizeSupabaseUrl,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabaseClient';
import { AppSettings } from '../types/carwash';

const GRANT_FIX_SQL = `GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`;

interface DatabaseSettingsViewProps {
  settings: AppSettings;
  supabaseConnected: boolean;
  syncing: boolean;
  syncError: string | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onSyncSupabase: () => Promise<boolean>;
  onPushToSupabase: () => Promise<{ ok: boolean; message: string }>;
  onResetDemoData: () => void;
  onLockSettings: () => void;
}

export const DatabaseSettingsView: React.FC<DatabaseSettingsViewProps> = ({
  settings,
  supabaseConnected,
  syncing,
  syncError,
  onUpdateSettings,
  onSyncSupabase,
  onPushToSupabase,
  onResetDemoData,
  onLockSettings,
}) => {
  const initialCfg = getSavedSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(initialCfg.url);
  const [sbKey, setSbKey] = useState(initialCfg.anonKey);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedGrantSql, setCopiedGrantSql] = useState(false);

  // Settings local form
  const [businessName, setBusinessName] = useState(settings.business_name);
  const [branchName, setBranchName] = useState(settings.branch_name);
  const [taxNo, setTaxNo] = useState(settings.tax_registration_no);
  const [vatRate, setVatRate] = useState(settings.vat_rate);
  const [passcode, setPasscode] = useState(settings.access_passcode);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setBusinessName(settings.business_name);
    setBranchName(settings.branch_name);
    setTaxNo(settings.tax_registration_no);
    setVatRate(settings.vat_rate);
    setPasscode(settings.access_passcode);
  }, [settings]);

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    const cleanUrl = normalizeSupabaseUrl(sbUrl);
    setSbUrl(cleanUrl);
    const config = { url: cleanUrl, anonKey: sbKey.trim() };
    const res = await testSupabaseConnection(config);
    setTestResult(res);
    if (res.ok) {
      saveSupabaseConfig(config);
      await onSyncSupabase();
    }
    setTesting(false);
  };

  const handleCopyGrantSql = async () => {
    await navigator.clipboard.writeText(GRANT_FIX_SQL);
    setCopiedGrantSql(true);
    setTimeout(() => setCopiedGrantSql(false), 2500);
  };

  const handlePushLocalToSupabase = async () => {
    setPushing(true);
    setTestResult(null);
    const res = await onPushToSupabase();
    setTestResult(res);
    setPushing(false);
  };

  const handleDisconnectSupabase = async () => {
    clearSupabaseConfig();
    setSbUrl('');
    setSbKey('');
    await onSyncSupabase();
    setTestResult({
      ok: true,
      message: 'تم فصل الاتصال بـ Supabase والعودة للوضع المحلي التجريبي.',
    });
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([schemaSql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alahram_care_supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveBusinessSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings({
      business_name: businessName.trim(),
      branch_name: branchName.trim(),
      tax_registration_no: taxNo.trim(),
      vat_rate: Number(vatRate) || 14,
      access_passcode: passcode.trim() || '12345678',
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            الإعدادات العامة وربط قاعدة بيانات Supabase
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            ضبط بيانات الفرع والضريبة، ربط قاعدة البيانات السحابية، وإدارة كود SQL من شاشة الإدارة.
          </p>
        </div>

        <button
          type="button"
          onClick={onLockSettings}
          className="group px-3.5 py-2 rounded-xl border border-blue-200 bg-sky-50/80 hover:bg-blue-700 hover:border-blue-700 text-xs font-semibold text-blue-700 hover:text-white flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap shadow-sm transition-all"
        >
          <Lock className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          <span>قفل شاشة الإعدادات</span>
        </button>
      </div>

      {/* Clear 3-Step Guide */}
      <div className="bg-orange-50/80 border border-orange-200/80 rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1 bg-white/75 border border-orange-200/60 rounded-xl p-3">
          <div className="font-bold text-orange-900">1. وضع التشغيل الحالي</div>
          <p className="text-slate-700 leading-relaxed">
            بدون إدخال رابط ومفتاح Supabase، يعمل التطبيق محلياً في المتصفح ولا يقرأ التعديلات اليدوية من لوحة Supabase.
          </p>
        </div>
        <div className="space-y-1 bg-white/75 border border-orange-200/60 rounded-xl p-3">
          <div className="font-bold text-orange-900">2. مكان المفتاح في واجهة Supabase الجديدة</div>
          <p className="text-slate-700 leading-relaxed">
            افتح <strong>Project Settings → API Keys</strong> وستجد <strong>Publishable key</strong> (يبدأ بـ <span className="font-mono-num">sb_publishable_</span>) بدلاً من anon، أو ستجد تبويب <strong>Legacy anon</strong> في نفس الصفحة.
          </p>
        </div>
        <div className="space-y-1 bg-white/75 border border-orange-200/60 rounded-xl p-3">
          <div className="font-bold text-orange-900">3. الربط الدائم مع GitHub Pages</div>
          <p className="text-slate-700 leading-relaxed">
            تكامل GitHub داخل Supabase مخصص لفروع القاعدة فقط. لربط الموقع نهائياً أدخل الرابط والمفتاح هنا أو أضف <span className="font-mono-num">VITE_SUPABASE_URL</span> و <span className="font-mono-num">VITE_SUPABASE_ANON_KEY</span> في Secrets الخاص بالمستودع.
          </p>
        </div>
      </div>

      {/* Top Grid: Supabase Connection + Business Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Supabase Connector */}
        <form
          onSubmit={handleTestAndSaveSupabase}
          className="lg:col-span-6 bg-sky-50/65 border border-sky-200 rounded-2xl shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">
                ربط قاعدة بيانات Supabase
              </h3>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                supabaseConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {supabaseConnected ? 'متصل بـ Supabase' : 'الوضع المحلي التجريبي'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            بعد تشغيل كود SQL بالأسفل في <strong>SQL Editor</strong>، الصق رابط المشروع ومفتاح{' '}
            <strong>Publishable key</strong> (أو <span className="font-mono-num">anon key</span> القديم) واضغط اختبار وحفظ.
          </p>

          <div>
            <label
              htmlFor="sb-project-url"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Supabase Project URL
            </label>
            <input
              id="sb-project-url"
              name="sb-project-url"
              type="url"
              dir="ltr"
              autoComplete="url"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="w-full h-10 px-3 rounded-xl border border-sky-200 bg-white text-xs font-mono-num shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="sb-api-key"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Supabase Publishable Key (أو Legacy Anon Key)
            </label>
            <div className="relative">
              <input
                id="sb-api-key"
                name="sb-api-key"
                type={showKey ? 'text' : 'password'}
                dir="ltr"
                autoComplete="off"
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                placeholder="sb_publishable_... أو eyJhbGciOi..."
                className="w-full h-10 pl-3 pr-10 rounded-xl border border-sky-200 bg-white text-xs font-mono-num shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {syncError && !testResult && (
            <div className="p-3 rounded-lg text-xs border bg-amber-50 text-amber-800 border-amber-200 space-y-2">
              <div>{syncError}</div>
              {(syncError.includes('permission denied') || syncError.includes('GRANT')) && (
                <button
                  type="button"
                  onClick={handleCopyGrantSql}
                  className="px-2.5 py-1 rounded bg-amber-900 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  {copiedGrantSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedGrantSql ? 'تم نسخ كود الصلاحيات' : 'نسخ كود إصلاح صلاحيات GRANT'}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={testing || syncing || pushing}
              className="btn-sheen group px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 transition-transform group-hover:rotate-90 ${
                  testing || syncing ? 'animate-spin' : ''
                }`}
              />
              <span>{testing ? 'جاري الاختبار...' : 'اختبار وحفظ الاتصال'}</span>
            </button>
            {supabaseConnected && (
              <>
                <button
                  type="button"
                  disabled={syncing || pushing}
                  onClick={() => onSyncSupabase()}
                  className="group px-3.5 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-700 hover:border-blue-700 text-blue-700 hover:text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 transition-transform group-hover:rotate-90 ${
                      syncing ? 'animate-spin' : ''
                    }`}
                  />
                  <span>جلب أحدث البيانات</span>
                </button>
                <button
                  type="button"
                  disabled={pushing || syncing}
                  onClick={handlePushLocalToSupabase}
                  className="btn-sheen group px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
                >
                  <UploadCloud className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
                  <span>{pushing ? 'جاري الرفع...' : 'رفع البيانات إلى Supabase'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-xs font-semibold text-slate-700 shadow-sm transition-all"
                >
                  فصل الاتصال
                </button>
              </>
            )}
          </div>
        </form>

        {/* Business, 14% VAT & Passcode Settings */}
        <form
          onSubmit={handleSaveBusinessSettings}
          className="lg:col-span-6 bg-stone-100/85 border border-stone-300/80 rounded-2xl shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">
                إعدادات المغسلة والضريبة وكلمة المرور
              </h3>
            </div>
            <button
              type="button"
              onClick={onResetDemoData}
              className="group text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 transition-transform group-hover:-rotate-90" />
              <span>استعادة البيانات الافتراضية</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="settings-business-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                اسم المغسلة / المركز
              </label>
              <input
                id="settings-business-name"
                name="business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-stone-300 bg-white text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="settings-branch-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                الفرع / العنوان
              </label>
              <input
                id="settings-branch-name"
                name="branch-name"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-stone-300 bg-white text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="settings-tax-no"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                السجل الضريبي
              </label>
              <input
                id="settings-tax-no"
                name="tax-no"
                type="text"
                dir="ltr"
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-stone-300 bg-white text-xs font-mono-num shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="settings-vat-rate"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                نسبة الضريبة (%)
              </label>
              <input
                id="settings-vat-rate"
                name="vat-rate"
                type="number"
                step="0.5"
                min={0}
                max={30}
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-xl border border-stone-300 bg-white text-xs font-mono-num shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="settings-terminal-passcode"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                رمز شاشة الدخول
              </label>
              <input
                id="settings-terminal-passcode"
                name="terminal-passcode"
                type="text"
                dir="ltr"
                autoComplete="off"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-stone-300 bg-white text-xs font-mono-num shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          {savedNotice && (
            <p className="text-xs font-semibold text-emerald-700">
              تم حفظ الإعدادات بنجاح.
            </p>
          )}

          <div className="pt-1">
            <button
              type="submit"
              className="btn-sheen px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </div>

      {/* Complete SQL Script Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-emerald-50/65 border-b border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              كود SQL الكامل لإنشاء قاعدة البيانات في Supabase
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              يتضمن الجداول، المشغلات التلقائية للمخزن، عروض التقارير، وبيانات تجريبية كاملة (أحمد مجدي، محمود كمال، الفواتير، والمنتجات).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySql}
              className="btn-sheen group px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-all"
            >
              {copiedSql ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
              )}
              <span>{copiedSql ? 'تم نسخ SQL' : 'نسخ كود SQL بالكامل'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="group px-3.5 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-700 hover:border-blue-700 text-blue-700 hover:text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
              <span>تحميل ملف .sql</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-900 text-slate-100 overflow-x-auto max-h-96" dir="ltr">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre">
            {schemaSql}
          </pre>
        </div>
      </div>
    </div>
  );
};
