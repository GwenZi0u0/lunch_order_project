import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const BROADCAST_KEY = 'windows_notification_broadcast';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: BROADCAST_KEY }
    });

    if (!setting?.value) {
      return NextResponse.json({ notification: null });
    }

    return NextResponse.json({ notification: JSON.parse(setting.value) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : 'TSA Lunch 通知';

    if (!message) {
      return NextResponse.json({ error: 'Notification message is required' }, { status: 400 });
    }

    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      createdAt: new Date().toISOString(),
      createdBy: user.userId
    };

    await prisma.siteSetting.upsert({
      where: { key: BROADCAST_KEY },
      update: { value: JSON.stringify(notification) },
      create: {
        key: BROADCAST_KEY,
        value: JSON.stringify(notification)
      }
    });

    return NextResponse.json({ notification });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
