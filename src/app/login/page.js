'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
    }
  }, []);

  const handleGoogleLogin = () => {
    setLoading(true);
    setError('');
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#F9F8F5] via-[#F4F1EA] to-[#eae8e4] px-4 py-8">
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[600px] w-[600px] rounded-full bg-[#FFDB27] opacity-[0.06] blur-[80px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[#EA5B3C] opacity-[0.05] blur-[100px]" />

      <div className="z-10 w-full max-w-[500px]">
        <div className="mb-5 text-center animate-fade-in">
          <div className="mb-2 inline-flex items-center gap-3 text-3xl font-bold tracking-widest text-[#333333]">
            CatChup Lunch
          </div>
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-[#888888]">
            LUNCH ORDER SYSTEM
          </p>
          <div className="login-cat-scene" aria-label="CatChup Lunch">
            <div className="login-cat-track">
              <div className="login-cat-runner">
                <span className="login-cat-tail">
                  <svg viewBox="0 0 36 28" aria-hidden="true">
                    <path d="M33 6 C23 1 12 2 10 10 C8 18 20 18 21 12 C22 5 10 7 4 22" />
                  </svg>
                </span>
                <span className="login-cat-body" />
                <span className="login-cat-head">
                  <span className="login-cat-ear login-cat-ear-left" />
                  <span className="login-cat-ear login-cat-ear-right" />
                  <span className="login-cat-eye" />
                  <span className="login-cat-whiskers" />
                </span>
                <span className="login-cat-leg login-cat-leg-front" />
                <span className="login-cat-leg login-cat-leg-back" />
                <span className="login-bento">
                  <span />
                </span>
              </div>
              <span className="login-cat-hole" />
              <span className="login-cat-heart" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#EAE8E4] bg-white p-8 shadow-xl transition-all duration-300 hover:shadow-2xl md:p-10">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <i className="ti ti-alert-circle text-lg" />
              {error}
            </div>
          )}

          <div className="mb-5 border-b border-[#EAE8E4] pb-4 text-center text-sm font-bold text-[#333333]">
            <i className="ti ti-brand-google mr-2" />
            Google 帳號登入
          </div>

          <p className="mb-7 rounded-lg bg-[#F9F8F5] px-4 py-3 text-center text-[11px] font-bold leading-5 text-[#888888]">
            <span className="block">
              協助團隊快速完成午餐訂購、餐點排程與儲值扣款管理。
            </span>
            <span className="mt-1 block">使用公司 Google 帳號登入</span>
          </p>

          <button
            disabled={loading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#EAE8E4] bg-white px-6 py-4 font-bold text-[#333333] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.01c2.34-2.15 3.53-5.32 3.53-8.74Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.54 1.19-3.95 1.19-3.05 0-5.63-2.06-6.55-4.83H1.31v3.22A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.45 14.33a7.14 7.14 0 0 1 0-4.66V6.45H1.31a12 12 0 0 0 0 11.1l4.14-3.22Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.31 6.45l4.14 3.22c.92-2.77 3.5-4.83 6.55-4.83Z" />
            </svg>
            {loading ? '正在前往 Google…' : '使用 Google 帳號登入'}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-[#888888]">
          © 2026 TSA Corp. Gwen project. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
