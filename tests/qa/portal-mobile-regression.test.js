import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('portal and mobile UI regressions', () => {
  it('keeps the portal navigation split into announcements, ordering, and spending log', () => {
    const navbar = readSource('src/components/Navbar.js');
    const portal = readSource('src/app/portal/page.js');
    const history = readSource('src/app/portal/history/page.js');
    const announcementsExists = fs.existsSync(path.join(root, 'src/app/portal/announcements/page.js'));

    expect(announcementsExists).toBe(true);
    expect(navbar).toContain("{ label: '公告欄', href: '/portal/announcements'");
    expect(navbar).toContain("{ label: '午餐訂購', href: '/portal'");
    expect(navbar).toContain("{ label: '消費日誌', href: '/portal/history'");
    expect(portal).toContain('週供餐日期選擇');
    expect(portal).not.toContain('fetchAnnouncement');
    expect(history).toContain('消費日誌');
    expect(history).toContain('個人歷史訂單與扣款紀錄');
  });

  it('keeps the hamburger menu responsive with an icon-only mode switch in the mobile profile row', () => {
    const navbar = readSource('src/components/Navbar.js');

    expect(navbar).toContain("const [isMenuOpen, setIsMenuOpen]");
    expect(navbar).toContain("aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}");
    expect(navbar).toContain("className=\"md:hidden w-10 h-10");
    expect(navbar).toContain("icon: 'ti ti-switch-horizontal'");
    expect(navbar).toContain('title={modeSwitch.label}');
    expect(navbar).toContain('aria-label={modeSwitch.label}');
    expect(navbar).toContain('className="ml-auto w-10 h-10');
    expect(navbar).not.toContain('<span>{modeSwitch.label}</span>');
  });

  it('prevents delivered admin schedules from being treated as holidays', () => {
    const schedulePage = readSource('src/app/admin/schedule/page.js');
    const deliverRoute = readSource('src/app/api/admin/deliver/route.js');

    expect(schedulePage).toContain('!activeSchedule.isOpen && !activeSchedule.deliveredAt');
    expect(schedulePage).toContain('!sched.isOpen && !sched.deliveredAt');
    expect(schedulePage).toContain('historySchedule.isOpen || historySchedule.deliveredAt');
    expect(deliverRoute).toContain('deliveredAt: now');
    expect(deliverRoute).not.toContain('isOpen: false');
  });

  it('keeps mobile wallet controls compact and email access touch-friendly', () => {
    const wallets = readSource('src/app/admin/wallets/page.js');

    expect(wallets).toContain("const [activeEmailUserId, setActiveEmailUserId] = useState('')");
    expect(wallets).toContain('setActiveEmailUserId(prev => prev === u.id ?');
    expect(wallets).toContain('onPointerDown={(e) => e.stopPropagation()}');
    expect(wallets).toContain('onMouseDown={(e) => e.stopPropagation()}');
    expect(wallets).not.toContain('src={u.avatarUrl} alt="" className="w-5 h-5');
    expect(wallets).toContain('h-8 w-8 sm:h-auto sm:w-auto');
    expect(wallets).toContain('<span className="hidden sm:inline">儲值</span>');
    expect(wallets).toContain('<span className="hidden sm:inline">異動</span>');
  });

  it('hides mobile wallet amount signs while preserving responsive desktop signs', () => {
    const wallets = readSource('src/app/admin/wallets/page.js');

    expect(wallets).toContain('<span className="hidden sm:inline">{balance > 0 ?');
    expect(wallets).toContain('<span className="hidden sm:inline">{tx.amount >= 0 ?');
    expect(wallets).toContain("balanceColor = 'text-green-600 font-bold'");
    expect(wallets).toContain("balanceColor = 'text-red-600 font-bold'");
    expect(wallets).toContain("tx.amount >= 0 ? 'text-green-600' : 'text-red-600'");
  });
});
