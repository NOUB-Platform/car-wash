import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
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
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabaseClient';
import { AppSettings } from '../types/carwash';

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
  const [copiedSql, setCopiedSql] = useState(false);

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
    const config = { url: sbUrl.trim(), anonKey: sbKey.trim() };
    const res = await testSupabaseConnection(config);
    setTestResult(res);
    if (res.ok) {
      saveSupabaseConfig(config);
      await onSyncSupabase();
    }
    setTesting(false);
  };

  const handlePushLocalToSupabase = async () => {
    setPushing(true);
    setTestResult(null);
    const res = await onPushToSupabase();
    setTestResult(res);
    setPushing(false);
  };

  const handleDisconnectSupabase = () => {
    clearSupabaseConfig();
    setSbUrl('');
    setSbKey('');
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
    a.download = 'naqaa_carwash_supabase_schema.sql';
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
          className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>قفل شاشة الإعدادات</span>
        </button>
      </div>

      {/* Clear 3-Step Guide */}
      <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-blue-800">1. وضع التشغيل الحالي</div>
          <p className="text-slate-700 leading-relaxed">
            التطبيق يعمل الآن مباشرة ببيانات تجريبية محفوظة في المتصفح (بأسماء أحمد مجدي ومحمود كمال) لتجربة كل الشاشات فوراً.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-blue-800">2. إنشاء الجداول في Supabase</div>
          <p className="text-slate-700 leading-relaxed">
            انسخ كود الـ SQL بالأسفل (أو من ملف <span className="font-mono-num">supabase/schema.sql</span>) والصقه داخل <strong>SQL Editor</strong> في Supabase ثم اضغط Run.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-blue-800">3. الربط والنشر على GitHub Pages</div>
          <p className="text-slate-700 leading-relaxed">
            أدخل <span className="font-mono-num">Project URL</span> و <span className="font-mono-num">Anon Key</span> هنا. وعند النشر على GitHub اختر من <strong>Settings → Pages → Source</strong> خيار <strong>GitHub Actions</strong> بدلاً من Branch.
          </p>
        </div>
      </div>

      {/* Top Grid: Supabase Connection + Business Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Supabase Connector */}
        <form
          onSubmit={handleTestAndSaveSupabase}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
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
            بعد إنشاء حساب ومشروع في Supabase وتشغيل كود SQL بالأسفل في{' '}
            <strong>SQL Editor</strong>، الصق رابط المشروع ومفتاح{' '}
            <span className="font-mono-num">anon public key</span> هنا للربط الفوري.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              dir="ltr"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supabase Anon Key
            </label>
            <input
              type="password"
              dir="ltr"
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
            />
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
            <div className="p-3 rounded-lg text-xs border bg-amber-50 text-amber-800 border-amber-200">
              {syncError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={testing || syncing || pushing}
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing || syncing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'جاري الاختبار...' : 'اختبار وحفظ الاتصال'}</span>
            </button>
            {supabaseConnected && (
              <>
                <button
                  type="button"
                  disabled={pushing || syncing}
                  onClick={handlePushLocalToSupabase}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{pushing ? 'جاري الرفع...' : 'رفع البيانات إلى Supabase'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
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
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
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
              className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة البيانات الافتراضية</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                اسم المغسلة / المركز
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الفرع
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                السجل الضريبي
              </label>
              <input
                type="text"
                dir="ltr"
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نسبة الضريبة (%)
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={30}
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                رمز شاشة الدخول
              </label>
              <input
                type="text"
                dir="ltr"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono-num"
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
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </div>

      {/* Complete SQL Script Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              كود SQL الكامل لإنشاء قاعدة البيانات في Supabase
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              يتضمن الجداول، المشغلات التلقائية للمخزن، عروض التقارير، وبيانات تجريبية كاملة (أحمد مجدي، محمود كمال، الفواتير، والمنتجات).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySql}
              className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'تم نسخ SQL' : 'نسخ كود SQL بالكامل'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
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
