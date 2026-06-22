import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ALLOW_NEXT_WEEK_MENU_KEY = 'allow_next_week_menu';

function parseBooleanSetting(value, fallback = true) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: ALLOW_NEXT_WEEK_MENU_KEY }
    });

    return NextResponse.json({
      allowNextWeekMenu: parseBooleanSetting(setting?.value)
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

    const setting = await prisma.siteSetting.upsert({
      where: { key: ALLOW_NEXT_WEEK_MENU_KEY },
      update: { value: String(allowNextWeekMenu) },
      create: {
        key: ALLOW_NEXT_WEEK_MENU_KEY,
        value: String(allowNextWeekMenu)
      }
    });

    return NextResponse.json({
      allowNextWeekMenu: parseBooleanSetting(setting.value)
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
