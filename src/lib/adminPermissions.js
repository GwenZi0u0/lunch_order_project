export const ADMIN_VIEW_PAGES = [
  { value: 'overview', label: '訂單公告', href: '/admin' },
  { value: 'schedule', label: '供餐排程', href: '/admin/schedule' },
  { value: 'order-stats', label: '訂餐統計', href: '/admin/order-stats' },
  { value: 'restaurants', label: '餐廳管理', href: '/admin/restaurants' },
  { value: 'wallets', label: '儲值管理', href: '/admin/wallets' },
  { value: 'accounting-audit', label: '帳務軌跡', href: '/admin/accounting-audit' },
];

export function getViewerPage(value) {
  return ADMIN_VIEW_PAGES.find(page => page.value === value) || null;
}

export function canAccessAdminPage(user, page) {
  return user?.role === 'admin' || (user?.role === 'viewer' && user?.viewerPage === page);
}

export function canReadAdminData(user, pages) {
  return user?.role === 'admin' || (user?.role === 'viewer' && pages.includes(user?.viewerPage));
}
