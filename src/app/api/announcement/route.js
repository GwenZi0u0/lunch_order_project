import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ANNOUNCEMENTS_KEY = 'portal_announcements';
const LEGACY_ANNOUNCEMENT_TITLE_KEY = 'portal_announcement_title';
const LEGACY_ANNOUNCEMENT_KEY = 'portal_announcement';
const LEGACY_ORDER_GUIDE_TITLE_KEY = 'portal_order_guide_title';
const LEGACY_ORDER_GUIDE_KEY = 'portal_order_guide';

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'default-rules',
    title: '午餐訂購規則',
    content: `1. 請於每日截止時間前完成訂餐。
2. 訂單送出後仍可在截止前修改或取消。
3. 餐點送達後由管理者確認並自動扣款。`,
    updatedAt: null
  },
  {
    id: 'default-flow',
    title: '每日訂單流程說明',
    content: `每日開放訂購本週與下週工作日午餐。
請於每日 09:40 前完成訂餐，截止後無法新增、修改或取消。
餐點送達後，管理者會確認送達並由系統自動扣款。`,
    updatedAt: null
  }
];

function parseAnnouncements(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `announcement-${index}`,
      title: typeof item.title === 'string' ? item.title : '',
      content: typeof item.content === 'string' ? item.content : '',
      pinned: Boolean(item.pinned),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null
    }));
  } catch {
    return null;
  }
}

function normalizeAnnouncements(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: typeof item.id === 'string' && item.id ? item.id : `announcement-${Date.now()}-${index}`,
    title: typeof item.title === 'string' ? item.title.trim() : '',
    content: typeof item.content === 'string' ? item.content.trim() : '',
    pinned: Boolean(item.pinned),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
  }));
}

function sortAnnouncements(items) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return 0;
  });
}

function buildLegacyAnnouncements(settingMap) {
  const ruleTitle = settingMap[LEGACY_ANNOUNCEMENT_TITLE_KEY];
  const ruleContent = settingMap[LEGACY_ANNOUNCEMENT_KEY];
  const guideTitle = settingMap[LEGACY_ORDER_GUIDE_TITLE_KEY];
  const guideContent = settingMap[LEGACY_ORDER_GUIDE_KEY];

  if (!ruleTitle && !ruleContent && !guideTitle && !guideContent) {
    return DEFAULT_ANNOUNCEMENTS;
  }

  return [
    {
      id: 'legacy-rules',
      title: ruleTitle || DEFAULT_ANNOUNCEMENTS[0].title,
      content: ruleContent || DEFAULT_ANNOUNCEMENTS[0].content,
      updatedAt: null
    },
    {
      id: 'legacy-flow',
      title: guideTitle || DEFAULT_ANNOUNCEMENTS[1].title,
      content: guideContent || DEFAULT_ANNOUNCEMENTS[1].content,
      updatedAt: null
    }
  ];
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            ANNOUNCEMENTS_KEY,
            LEGACY_ANNOUNCEMENT_TITLE_KEY,
            LEGACY_ANNOUNCEMENT_KEY,
            LEGACY_ORDER_GUIDE_TITLE_KEY,
            LEGACY_ORDER_GUIDE_KEY
          ]
        }
      }
    });
    const settingMap = Object.fromEntries(settings.map(setting => [setting.key, setting.value]));
    const announcements = sortAnnouncements(
      parseAnnouncements(settingMap[ANNOUNCEMENTS_KEY])
        || buildLegacyAnnouncements(settingMap)
    );

    return NextResponse.json({ announcements });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const announcements = sortAnnouncements(normalizeAnnouncements(body.announcements));

    const setting = await prisma.siteSetting.upsert({
      where: { key: ANNOUNCEMENTS_KEY },
      update: { value: JSON.stringify(announcements) },
      create: {
        key: ANNOUNCEMENTS_KEY,
        value: JSON.stringify(announcements)
      }
    });

    return NextResponse.json({
      announcements: sortAnnouncements(parseAnnouncements(setting.value) || [])
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
