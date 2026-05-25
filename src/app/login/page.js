'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dev'); // 'google' or 'dev'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeveloperLogin = async (role, userType = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'developer_login',
          role,
          userType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '登入失敗');
      }

      // Success, redirect
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-gradient-to-br from-[#F9F8F5] via-[#F4F1EA] to-[#eae8e4]">
      {/* Decorative background shapes */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#FFDB27] opacity-[0.06] blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#EA5B3C] opacity-[0.05] blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[500px] z-10">
        {/* Logo and Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-3 font-bold text-3xl tracking-widest text-[#333333] mb-4">
            LUNCH KAIZEN <span className="bg-[#EA5B3C] text-white text-base px-3 py-1 rounded font-normal tracking-normal">改善</span>
          </div>
          <p className="text-sm font-bold tracking-[0.2em] text-[#888888] uppercase mb-2">LUNCH ORDER SYSTEM</p>
          <div className="inline-block bg-[#FFDB27] text-[#333333] font-bold text-sm px-6 py-2 rounded-xl shadow-sm">
            現場をもっと自由に、面白く ─ 讓訂餐更自由、更便利、更有趣！
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-xl overflow-hidden p-8 md:p-10 transition-all duration-300 hover:shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
              <i className="ti ti-alert-circle text-lg"></i>
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-[#EAE8E4] mb-8">
            <button
              onClick={() => setActiveTab('dev')}
              className={`flex-1 pb-4 text-sm font-bold border-b-2 transition-all duration-300 ${
                activeTab === 'dev'
                  ? 'border-[#EA5B3C] text-[#EA5B3C]'
                  : 'border-transparent text-[#888888] hover:text-[#333333]'
              }`}
            >
              <i className="ti ti-terminal-2 mr-2"></i>開發者快速登入
            </button>
            <button
              onClick={() => setActiveTab('google')}
              className={`flex-1 pb-4 text-sm font-bold border-b-2 transition-all duration-300 ${
                activeTab === 'google'
                  ? 'border-[#EA5B3C] text-[#EA5B3C]'
                  : 'border-transparent text-[#888888] hover:text-[#333333]'
              }`}
            >
              <i className="ti ti-brand-google mr-2"></i>Google 帳號登入
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'dev' && (
            <div className="space-y-6">
              <div className="text-xs text-[#888888] leading-relaxed mb-4">
                💡 <b>說明</b>：為了方便您在本地無痛測試，此模式免去配置 Google API Console 的流程。請點選以下角色模擬登入，觀察系統對不同餘額與權限的視覺回應：
              </div>

              {/* Admin Button */}
              <button
                disabled={loading}
                onClick={() => handleDeveloperLogin('admin')}
                className="w-full flex items-center justify-between p-5 border border-[#EAE8E4] rounded-xl hover:border-[#EA5B3C] hover:bg-orange-[0.01] text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-50 text-[#EA5B3C] flex items-center justify-center text-2xl">
                    <i className="ti ti-shield-check"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#333333] group-hover:text-[#EA5B3C] transition-colors">管理者 Admin</h4>
                    <p className="text-xs text-[#888888] mt-1">排定菜單、手動儲值、OCR 掃描、扣款</p>
                  </div>
                </div>
                <i className="ti ti-chevron-right text-[#888888] group-hover:translate-x-1 transition-transform"></i>
              </button>

              <div className="h-px bg-[#EAE8E4] my-2"></div>
              <p className="text-xs font-bold text-[#888888] tracking-wider mb-2">訂購者 User (三種餘額情境)</p>

              {/* User - Positive */}
              <button
                disabled={loading}
                onClick={() => handleDeveloperLogin('user', 'positive')}
                className="w-full flex items-center justify-between p-4 border border-[#EAE8E4] rounded-xl hover:border-[#EA5B3C] text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl">
                    <i className="ti ti-wallet"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#333333] group-hover:text-[#EA5B3C]">張小華 <span className="text-xs font-normal text-green-600 ml-1">正常</span></h4>
                    <p className="text-xs text-[#888888] mt-0.5">儲值金餘額：<span className="text-green-600 font-bold">＋NT$ 250</span> (綠色字體)</p>
                  </div>
                </div>
                <i className="ti ti-chevron-right text-[#888888] group-hover:translate-x-1 transition-transform"></i>
              </button>

              {/* User - Neutral */}
              <button
                disabled={loading}
                onClick={() => handleDeveloperLogin('user', 'neutral')}
                className="w-full flex items-center justify-between p-4 border border-[#EAE8E4] rounded-xl hover:border-[#EA5B3C] text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center text-xl">
                    <i className="ti ti-wallet"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#333333] group-hover:text-[#EA5B3C]">李明輝 <span className="text-xs font-normal text-gray-500 ml-1">餘額歸零</span></h4>
                    <p className="text-xs text-[#888888] mt-0.5">儲值金餘額：<span className="text-gray-700 font-bold">NT$ 0</span> (灰色字體)</p>
                  </div>
                </div>
                <i className="ti ti-chevron-right text-[#888888] group-hover:translate-x-1 transition-transform"></i>
              </button>

              {/* User - Negative */}
              <button
                disabled={loading}
                onClick={() => handleDeveloperLogin('user', 'negative')}
                className="w-full flex items-center justify-between p-4 border border-[#EAE8E4] rounded-xl hover:border-red-200 hover:bg-red-[0.01] hover:border-[#EA5B3C] text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl animate-pulse">
                    <i className="ti ti-alert-circle"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#333333] group-hover:text-[#EA5B3C]">王大同 <span className="text-xs font-normal text-red-600 ml-1">欠款警示</span></h4>
                    <p className="text-xs text-[#888888] mt-0.5">儲值金餘額：<span className="text-red-600 font-bold">－NT$ 80</span> (紅字 + 繳款警示)</p>
                  </div>
                </div>
                <i className="ti ti-chevron-right text-[#888888] group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          )}

          {activeTab === 'google' && (
            <div className="space-y-6 py-4">
              <div className="text-sm text-[#888888] leading-relaxed mb-6">
                您可以在後台的環境變數檔 `.env` 設定 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 來啟用真實的 Google 單一登入。目前本機開發環境建議先使用 **開發者快速登入** 面板進行功能驗證。
              </div>

              {/* Google Button */}
              <button
                disabled={true}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-[#EAE8E4] rounded-xl bg-[#F9F8F5] text-[#888888] font-bold cursor-not-allowed transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.01c2.34-2.15 3.53-5.32 3.53-8.74Z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.54 1.19-3.95 1.19-3.05 0-5.63-2.06-6.55-4.83H1.31v3.22A12 12 0 0 0 12 24Z"/>
                  <path fill="#FBBC05" d="M5.45 14.33a7.14 7.14 0 0 1 0-4.66V6.45H1.31a12 12 0 0 0 0 11.1l4.14-3.22Z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.31 6.45l4.14 3.22c.92-2.77 3.5-4.83 6.55-4.83Z"/>
                </svg>
                Google 帳號登入 (請先配置憑證)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#888888] mt-8">
          © 2026 TSK Corp. KAIZEN project team. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
