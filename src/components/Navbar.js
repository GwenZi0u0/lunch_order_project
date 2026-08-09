'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar({ user, interactionDisabled = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const isAdmin = user?.role === 'admin';
  const isViewer = user?.role === 'viewer';
  const isOrderingView = pathname?.startsWith('/portal');
  const logoHref = user
    ? isAdmin && !isOrderingView ? '/admin' : '/portal'
    : '/';
  const displayName = user?.name?.replace(/\s*\((餘額充足|餘額歸零|帳戶欠款)\)\s*$/, '') || '';

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = event => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    document.body.classList.add('mobile-menu-open');

    const preventBackgroundScroll = event => {
      if (mobileMenuRef.current?.contains(event.target)) return;
      event.preventDefault();
    };
    const preventBackgroundKeys = event => {
      if (mobileMenuRef.current?.contains(event.target)) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        event.preventDefault();
      }
    };

    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    document.addEventListener('keydown', preventBackgroundKeys);

    return () => {
      document.body.classList.remove('mobile-menu-open');
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
      document.removeEventListener('keydown', preventBackgroundKeys);
    };
  }, [isMenuOpen]);

  const navigateTo = (href) => {
    if (interactionDisabled) return;
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    if (interactionDisabled) return;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      if (res.ok) {
        setIsMenuOpen(false);
        setIsProfileOpen(false);
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('登出失敗:', err);
    }
  };

  const adminNavItems = [
        { label: '訂單公告', href: '/admin#order-stats-announcement', page: 'overview', icon: 'ti ti-clipboard-list' },
        { label: '供餐排程', href: '/admin/schedule', page: 'schedule', icon: 'ti ti-calendar-event' },
        { label: '訂餐統計', href: '/admin/order-stats', page: 'order-stats', icon: 'ti ti-chart-bar' },
        { label: '餐廳管理', href: '/admin/restaurants', page: 'restaurants', icon: 'ti ti-tools-kitchen-2' },
        { label: '儲值管理', href: '/admin/wallets', page: 'wallets', icon: 'ti ti-wallet' },
        { label: '帳務軌跡', href: '/admin/accounting-audit', page: 'accounting-audit', icon: 'ti ti-file-invoice' },
        { label: '人員管理', href: '/admin/users', page: 'users', icon: 'ti ti-users' },
      ];

  const orderingNavItems = [
    { label: '訂購者首頁', href: '/portal', icon: 'ti ti-home' },
    { label: '午餐訂購', href: '/portal/order', icon: 'ti ti-tools-kitchen-2' },
    { label: '消費日誌', href: '/portal/history', icon: 'ti ti-history' },
  ];

  const navItems = isViewer
    ? [...orderingNavItems, ...adminNavItems.filter(item => item.page === user?.viewerPage)]
    : isAdmin && !isOrderingView
    ? [
        { label: '訂單公告', href: '/admin#order-stats-announcement', icon: 'ti ti-clipboard-list' },
        { label: '供餐排程', href: '/admin/schedule', icon: 'ti ti-calendar-event' },
        { label: '訂餐統計', href: '/admin/order-stats', icon: 'ti ti-chart-bar' },
        { label: '餐廳管理', href: '/admin/restaurants', icon: 'ti ti-tools-kitchen-2' },
        { label: '儲值管理', href: '/admin/wallets', icon: 'ti ti-wallet' },
        { label: '帳務軌跡', href: '/admin/accounting-audit', icon: 'ti ti-file-invoice' },
        { label: '人員管理', href: '/admin/users', icon: 'ti ti-users' },
      ]
    : orderingNavItems;

  const modeSwitch = isAdmin
    ? {
        label: isOrderingView ? '切換至管理者後台' : '切換至訂購者介面',
        href: isOrderingView ? '/admin' : '/portal',
        icon: 'ti ti-switch-horizontal',
      }
    : null;

  const roleLabel = isViewer ? '訂購者 / 檢視者' : isAdmin
    ? isOrderingView ? '管理者 / 訂購者檢視' : '管理者'
    : '訂購者';

  return (
    <header
      inert={interactionDisabled ? '' : undefined}
      aria-disabled={interactionDisabled || undefined}
      className={`sticky top-0 z-50 bg-[#F9F8F5]/90 backdrop-blur-md border-b border-[#EAE8E4] px-4 sm:px-6 py-4 transition-all duration-300 ${interactionDisabled ? 'pointer-events-none select-none' : ''}`}
    >
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <div
            onClick={() => navigateTo(logoHref)}
            className="font-bold text-xl tracking-wider text-[#333333] cursor-pointer flex items-center gap-2 whitespace-nowrap"
          >
            <img
              src="/CatChupLunchLogo.png"
              alt=""
              className="h-8 w-auto shrink-0 object-contain"
              aria-hidden="true"
            />
            CatChup Lunch
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
            <div ref={profileMenuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setIsProfileOpen(current => !current)}
                aria-label="開啟帳號選單"
                aria-expanded={isProfileOpen}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#EAE8E4] bg-white shadow-sm transition-all hover:border-[#EA5B3C] focus:outline-none focus:ring-2 focus:ring-[#EA5B3C]/25"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#EA5B3C] text-sm font-bold text-white">
                    {displayName.charAt(0)}
                  </span>
                )}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full z-[70] mt-2 w-64 overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                  <div className="border-b border-[#EAE8E4] px-4 py-3">
                    <div className="truncate text-sm font-bold text-[#333333]">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-[#888888]">{user.email}</div>
                    <div className="mt-1 text-[10px] font-bold text-[#EA5B3C]">{roleLabel}</div>
                  </div>
                  <div className="p-2">
                    {modeSwitch && (
                      <button
                        type="button"
                        onClick={() => navigateTo(modeSwitch.href)}
                        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-[#555555] transition-all hover:bg-[#F9F8F5] hover:text-[#EA5B3C]"
                      >
                        <i className={`${modeSwitch.icon} text-lg`}></i>
                        <span>{modeSwitch.label}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-[#555555] transition-all hover:bg-red-50 hover:text-red-600"
                    >
                      <i className="ti ti-logout text-lg"></i>
                      <span>登出</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

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
        <div ref={mobileMenuRef} className="absolute left-4 right-4 top-full z-[60] mt-2 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain rounded-xl border border-[#EAE8E4] bg-white shadow-[0_18px_44px_rgba(0,0,0,0.16)] md:hidden">
          <nav className="p-2">
            <div className="mb-2 border-b border-[#EAE8E4] px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#333333]">{displayName}</div>
                  <div className="mt-1 truncate text-xs text-[#888888]">{user.email}</div>
                  <div className="mt-1 text-[10px] font-bold text-[#EA5B3C]">{roleLabel}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {modeSwitch && (
                    <button
                      type="button"
                      onClick={() => navigateTo(modeSwitch.href)}
                      title={modeSwitch.label}
                      aria-label={modeSwitch.label}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#555555] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                    >
                      <i className={`${modeSwitch.icon} text-lg`}></i>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="登出"
                    aria-label="登出"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#555555] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <i className="ti ti-logout text-lg"></i>
                  </button>
                </div>
              </div>
            </div>

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
          </nav>
        </div>
      )}
    </header>
  );
}
