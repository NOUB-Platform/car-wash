import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-center">
            <h1 className="text-lg font-bold text-slate-900">
              تعذر تحميل واجهة النظام
            </h1>
            <p className="text-xs text-red-600 font-mono" dir="ltr">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold"
            >
              إعادة ضبط البيانات وإعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
