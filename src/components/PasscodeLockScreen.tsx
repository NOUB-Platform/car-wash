import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import studioImg from '../assets/images/clean_carwash_studio_1795127894234.jpg';
import { BrandLogo } from './BrandLogo';

interface PasscodeLockScreenProps {
  businessName: string;
  branchName: string;
  expectedPasscode: string;
  onUnlock: () => void;
}

export const PasscodeLockScreen: React.FC<PasscodeLockScreenProps> = ({
  businessName,
  branchName,
  expectedPasscode,
  onUnlock,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === expectedPasscode) {
      setError(null);
      onUnlock();
    } else {
      setError('كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleDigit = (digit: string) => {
    setError(null);
    setPasscode((prev) => (prev.length < 16 ? prev + digit : prev));
  };

  const handleBackspace = () => {
    setError(null);
    setPasscode((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Right Column (RTL first): Passcode Form */}
        <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <BrandLogo size="lg" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  {businessName}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">{branchName}</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>بوابة التشغيل الآمنة</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                دخول نظام المغسلة والمبيعات
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                أدخل رمز المرور الثابت لبدء تشغيل نقطة البيع، إدارة حارات الغسيل، والمخزن.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="access-passcode"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  كلمة مرور النظام
                </label>
                <div className="relative">
                  <input
                    id="access-passcode"
                    name="access-passcode"
                    type={showPasscode ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passcode}
                    onChange={(e) => {
                      setError(null);
                      setPasscode(e.target.value);
                    }}
                    placeholder="أدخل رمز الدخول..."
                    autoFocus
                    dir="ltr"
                    className="w-full h-12 px-4 pl-12 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-center font-mono-num text-lg tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    aria-label={showPasscode ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>

              {/* Compact Quick Keypad */}
              <div className="grid grid-cols-5 gap-2 pt-1" dir="ltr">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDigit(d)}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-mono-num font-semibold text-sm transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 h-11 px-5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" />
                  <span>فتح النظام</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-11 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  مسح رقم
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>الرمز المبدئي للتشغيل: <strong className="font-mono-num text-slate-800">12345678</strong></span>
            <span>ضريبة القيمة المضافة: 14% (مصر)</span>
          </div>
        </div>

        {/* Left Column: Clean Studio Preview */}
        <div className="lg:col-span-6 relative min-h-[280px] bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
          {!imgError ? (
            <img
              src={studioImg}
              alt="صالة العناية وغسيل السيارات الحديثة"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-100 to-blue-50 text-slate-500">
              <BrandLogo size="lg" className="mb-3" />
              <p className="text-sm font-semibold text-slate-700">{businessName}</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent text-white">
            <p className="text-sm font-semibold">فصل كامل بين فواتير الغسيل ومبيعات المنتجات</p>
            <p className="text-xs text-slate-200 mt-1">
              إدارة حارات الغسيل · تسعير التكلفة والربح · تتبع المخزن · جاهز للربط مع Supabase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
