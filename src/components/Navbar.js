'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isOrderingView = pathname?.startsWith('/portal');

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const navigateTo = (href) => {
    setIsMenuOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      if (res.ok) {
        setIsMenuOpen(false);
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('登出失敗:', err);
    }
  };

  const navItems = isAdmin && !isOrderingView
    ? [
        { label: '訂單公告', href: '/admin#order-stats-announcement', icon: 'ti ti-clipboard-list' },
        { label: '供餐排程', href: '/admin/schedule', icon: 'ti ti-calendar-event' },
        { label: '餐廳管理', href: '/admin/restaurants', icon: 'ti ti-tools-kitchen-2' },
        { label: '儲值管理', href: '/admin/wallets', icon: 'ti ti-wallet' },
      ]
    : [
        { label: '公告欄', href: '/portal/announcements', icon: 'ti ti-speakerphone' },
        { label: '午餐訂購', href: '/portal', icon: 'ti ti-tools-kitchen-2' },
        { label: '消費日誌', href: '/portal/history', icon: 'ti ti-history' },
      ];

  const modeSwitch = isAdmin
    ? {
        label: isOrderingView ? '管理者後台' : '訂購者介面',
        href: isOrderingView ? '/admin' : '/portal',
        icon: isOrderingView ? 'ti ti-settings' : 'ti ti-tools-kitchen-2',
      }
    : null;

  return (
    <header className="sticky top-0 z-50 bg-[#F9F8F5]/90 backdrop-blur-md border-b border-[#EAE8E4] px-4 sm:px-6 py-4 transition-all duration-300">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <div
            onClick={() => navigateTo('/')}
            className="font-bold text-xl tracking-wider text-[#333333] cursor-pointer flex items-center gap-2 whitespace-nowrap"
          >
            TSA Lunch
          </div>

          {user && (
            <nav className="hidden md:flex gap-6 items-center">
              {navItems.map(item => (
                <button
                  key={item.href}
                  onClick={() => navigateTo(item.href)}
                  className={`text-sm font-bold transition-colors ${
                    pathname === item.href
                      ? 'text-[#EA5B3C]'
                      : 'text-[#333333] hover:text-[#EA5B3C]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-4">
            {modeSwitch && (
              <button
                onClick={() => navigateTo(modeSwitch.href)}
                className="hidden sm:flex items-center gap-1.5 text-xs font-bold border border-[#EAE8E4] px-3 py-2 bg-white rounded-full hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
              >
                <i className={modeSwitch.icon}></i>
                {modeSwitch.label}
              </button>
            )}

            <div className="hidden sm:flex items-center gap-3 bg-white border border-[#EAE8E4] px-3 sm:px-4 py-1.5 rounded-full shadow-sm min-w-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-6 h-6 rounded-full object-cover border border-[#D6D1CA] shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#EA5B3C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user.name.charAt(0)}
                </div>
              )}
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-[#333333] line-clamp-1 max-w-[120px]">{user.name}</span>
                <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
                  {isAdmin ? (isOrderingView ? '管理者 / 訂購者檢視' : '管理者') : '訂購者'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="登出"
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] bg-white transition-all duration-200"
            >
              <i className="ti ti-logout text-lg"></i>
            </button>

            <button
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
              aria-expanded={isMenuOpen}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#333333] hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
            >
              <i className={`${isMenuOpen ? 'ti ti-x' : 'ti ti-menu-2'} text-xl`}></i>
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigateTo('/login')}
            className="text-xs font-bold bg-[#EA5B3C] text-white px-5 py-2 rounded-full hover:bg-[#333333] transition-colors"
          >
            登入
          </button>
        )}
      </div>

      {user && isMenuOpen && (
        <div className="md:hidden mt-4 rounded-xl border border-[#EAE8E4] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 bg-[#F9F8F5] border-b border-[#EAE8E4]">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover border border-[#D6D1CA]"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#EA5B3C] text-white flex items-center justify-center text-sm font-bold">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#333333] truncate">{user.name}</div>
              <div className="text-[11px] text-[#888888] font-bold">
                {isAdmin ? (isOrderingView ? '管理者 / 訂購者檢視' : '管理者') : '訂購者'}
              </div>
            </div>
          </div>

          <nav className="p-2">
            {navItems.map(item => (
              <button
                key={item.href}
                onClick={() => navigateTo(item.href)}
                className={`w-full h-11 px-3 rounded-lg flex items-center gap-3 text-sm font-bold transition-all ${
                  pathname === item.href
                    ? 'bg-[#FFF3EF] text-[#EA5B3C]'
                    : 'text-[#333333] hover:bg-[#F9F8F5]'
                }`}
              >
                <i className={`${item.icon} text-lg`}></i>
                <span>{item.label}</span>
              </button>
            ))}

            {modeSwitch && (
              <button
                onClick={() => navigateTo(modeSwitch.href)}
                className="w-full h-11 px-3 rounded-lg flex items-center gap-3 text-sm font-bold text-[#333333] hover:bg-[#F9F8F5] transition-all"
              >
                <i className={`${modeSwitch.icon} text-lg`}></i>
                <span>{modeSwitch.label}</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full h-11 px-3 rounded-lg flex items-center gap-3 text-sm font-bold text-[#888888] hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <i className="ti ti-logout text-lg"></i>
              <span>登出</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
