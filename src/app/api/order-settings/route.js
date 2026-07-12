import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ALLOW_NEXT_WEEK_MENU_KEY = 'allow_next_week_menu';
const NEXT_WEEK_MENU_WEEK_KEY = 'allow_next_week_menu_week';

function parseBooleanSetting(value, fallback = true) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStartKey(date = new Date()) {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return formatDateKey(monday);
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [ALLOW_NEXT_WEEK_MENU_KEY, NEXT_WEEK_MENU_WEEK_KEY] } }
    });
    const settingMap = Object.fromEntries(settings.map(setting => [setting.key, setting.value]));
    const currentWeekKey = getWeekStartKey();
    const openedWeekKey = settingMap[NEXT_WEEK_MENU_WEEK_KEY];
    let allowNextWeekMenu = parseBooleanSetting(settingMap[ALLOW_NEXT_WEEK_MENU_KEY]);

    if (allowNextWeekMenu && openedWeekKey && openedWeekKey !== currentWeekKey) {
      const setting = await prisma.siteSetting.upsert({
        where: { key: ALLOW_NEXT_WEEK_MENU_KEY },
        update: { value: 'false' },
        create: {
          key: ALLOW_NEXT_WEEK_MENU_KEY,
          value: 'false'
        }
      });
      allowNextWeekMenu = parseBooleanSetting(setting.value);
    }

    return NextResponse.json({
      allowNextWeekMenu
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
    const allowNextWeekMenu = Boolean(body.allowNextWeekMenu);
    const currentWeekKey = getWeekStartKey();

    const [setting] = await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: ALLOW_NEXT_WEEK_MENU_KEY },
        update: { value: String(allowNextWeekMenu) },
        create: {
          key: ALLOW_NEXT_WEEK_MENU_KEY,
          value: String(allowNextWeekMenu)
        }
      }),
      prisma.siteSetting.upsert({
        where: { key: NEXT_WEEK_MENU_WEEK_KEY },
        update: { value: currentWeekKey },
        create: {
          key: NEXT_WEEK_MENU_WEEK_KEY,
          value: currentWeekKey
        }
      })
    ]);

    return NextResponse.json({
      allowNextWeekMenu: parseBooleanSetting(setting.value)
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
