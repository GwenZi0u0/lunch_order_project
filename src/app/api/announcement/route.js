import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ANNOUNCEMENT_TITLE_KEY = 'portal_announcement_title';
const ANNOUNCEMENT_KEY = 'portal_announcement';
const ORDER_GUIDE_TITLE_KEY = 'portal_order_guide_title';
const ORDER_GUIDE_KEY = 'portal_order_guide';

const DEFAULT_ANNOUNCEMENT_TITLE = '午餐訂購規則';
const DEFAULT_ORDER_GUIDE_TITLE = '每日訂單流程說明';

const DEFAULT_ANNOUNCEMENT = `午餐訂購規則
1. 請於每日截止時間前完成訂餐。
2. 訂單送出後仍可在截止前修改或取消。
3. 餐點送達後由管理者確認並自動扣款。`;

const DEFAULT_ORDER_GUIDE = `每日開放訂購本週與下週工作日午餐。
請於每日 09:40 前完成訂餐，截止後無法新增、修改或取消。
餐點送達後，管理者會確認送達並由系統自動扣款。`;

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settingKeys = [
      ANNOUNCEMENT_TITLE_KEY,
      ANNOUNCEMENT_KEY,
      ORDER_GUIDE_TITLE_KEY,
      ORDER_GUIDE_KEY
    ];

    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: settingKeys
        }
      }
    });
    const settingMap = Object.fromEntries(settings.map(setting => [setting.key, setting.value]));

    return NextResponse.json({
      announcementTitle: settingMap[ANNOUNCEMENT_TITLE_KEY] || DEFAULT_ANNOUNCEMENT_TITLE,
      announcement: settingMap[ANNOUNCEMENT_KEY] || DEFAULT_ANNOUNCEMENT,
      orderGuideTitle: settingMap[ORDER_GUIDE_TITLE_KEY] || DEFAULT_ORDER_GUIDE_TITLE,
      orderGuide: settingMap[ORDER_GUIDE_KEY] || DEFAULT_ORDER_GUIDE
    });
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
    const announcementTitle = typeof body.announcementTitle === 'string'
      ? body.announcementTitle.trim()
      : '';
    const announcement = typeof body.announcement === 'string'
      ? body.announcement.trim()
      : '';
    const orderGuideTitle = typeof body.orderGuideTitle === 'string'
      ? body.orderGuideTitle.trim()
      : '';
    const orderGuide = typeof body.orderGuide === 'string'
      ? body.orderGuide.trim()
      : '';

    if (!announcementTitle || !announcement || !orderGuideTitle || !orderGuide) {
      return NextResponse.json({ error: 'All portal home fields are required' }, { status: 400 });
    }

    const [announcementTitleSetting, announcementSetting, orderGuideTitleSetting, orderGuideSetting] = await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: ANNOUNCEMENT_TITLE_KEY },
        update: { value: announcementTitle },
        create: {
          key: ANNOUNCEMENT_TITLE_KEY,
          value: announcementTitle
        }
      }),
      prisma.siteSetting.upsert({
        where: { key: ANNOUNCEMENT_KEY },
        update: { value: announcement },
        create: {
          key: ANNOUNCEMENT_KEY,
          value: announcement
        }
      }),
      prisma.siteSetting.upsert({
        where: { key: ORDER_GUIDE_TITLE_KEY },
        update: { value: orderGuideTitle },
        create: {
          key: ORDER_GUIDE_TITLE_KEY,
          value: orderGuideTitle
        }
      }),
      prisma.siteSetting.upsert({
        where: { key: ORDER_GUIDE_KEY },
        update: { value: orderGuide },
        create: {
          key: ORDER_GUIDE_KEY,
          value: orderGuide
        }
      })
    ]);

    return NextResponse.json({
      announcementTitle: announcementTitleSetting.value,
      announcement: announcementSetting.value,
      orderGuideTitle: orderGuideTitleSetting.value,
      orderGuide: orderGuideSetting.value
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
