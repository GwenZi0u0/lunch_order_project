'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function Navbar({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';
  const isOrderingView = pathname?.startsWith('/portal');

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('登出失敗:', err);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#F9F8F5]/90 backdrop-blur-md border-b border-[#EAE8E4] px-6 py-4 flex justify-between items-center transition-all duration-300">
      <div className="flex items-center gap-6">
        <div 
          onClick={() => router.push('/')}
          className="font-bold text-xl tracking-wider text-[#333333] cursor-pointer flex items-center gap-2"
        >
          Lunch Kaizen <span className="bg-[#EA5B3C] text-white text-xs px-2 py-0.5 rounded font-normal">改善</span>
        </div>

        {user && (
          <nav className="hidden md:flex gap-6 items-center">
            {isAdmin && !isOrderingView ? (
              <>
                <button
                  onClick={() => router.push('/admin#order-stats-announcement')}
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  訂單統計與公告
                </button>
                <button
                  onClick={() => router.push('/admin/schedule')}
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  週菜單排程
                </button>
                <button 
                  onClick={() => router.push('/admin/restaurants')} 
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  餐廳與菜單
                </button>
                <button 
                  onClick={() => router.push('/admin/wallets')} 
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  帳務管理
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => router.push('/portal')} 
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  午餐訂購
                </button>
                <button 
                  onClick={() => router.push('/portal/history')} 
                  className="text-sm font-bold text-[#333333] hover:text-[#EA5B3C] transition-colors"
                >
                  歷史訂單
                </button>
              </>
            )}
          </nav>
        )}
      </div>

      {user ? (
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={() => router.push(isOrderingView ? '/admin' : '/portal')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold border border-[#EAE8E4] px-3 py-2 bg-white rounded-full hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
            >
              <i className={isOrderingView ? 'ti ti-settings' : 'ti ti-tools-kitchen-2'}></i>
              {isOrderingView ? '管理者模式' : '訂購者模式'}
            </button>
          )}

          {/* User Info */}
          <div className="flex items-center gap-3 bg-white border border-[#EAE8E4] px-4 py-1.5 rounded-full shadow-sm">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.name} 
                className="w-6 h-6 rounded-full object-cover border border-[#D6D1CA]"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#EA5B3C] text-white flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-[#333333] line-clamp-1 max-w-[120px]">{user.name}</span>
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                {isAdmin ? (isOrderingView ? '管理者 / 訂購視角' : '管理者') : '訂購者'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="登出系統"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] bg-white transition-all duration-200"
          >
            <i className="ti ti-logout text-lg"></i>
          </button>
        </div>
      ) : (
        <button
          onClick={() => router.push('/login')}
          className="text-xs font-bold bg-[#EA5B3C] text-white px-5 py-2 rounded-full hover:bg-[#333333] transition-colors"
        >
          登入系統
        </button>
      )}
    </header>
  );
}
