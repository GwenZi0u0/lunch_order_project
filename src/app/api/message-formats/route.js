import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canReadAdminData } from '@/lib/adminPermissions';

const MESSAGE_FORMATS_KEY = 'admin_message_formats';

function normalizeMessageFormats(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id
        ? item.id
        : `message-format-${Date.now()}-${index}`,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      content: typeof item.content === 'string' ? item.content.trim() : '',
      updatedAt: typeof item.updatedAt === 'string'
        ? item.updatedAt
        : new Date().toISOString(),
    }))
    .filter(item => item.title || item.content);
}

function parseMessageFormats(value) {
  if (!value) return [];

  try {
    return normalizeMessageFormats(JSON.parse(value));
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!canReadAdminData(user, ['overview'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: MESSAGE_FORMATS_KEY },
    });

    return NextResponse.json({
      messageFormats: parseMessageFormats(setting?.value),
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
    const messageFormats = normalizeMessageFormats(body.messageFormats);
    const setting = await prisma.siteSetting.upsert({
      where: { key: MESSAGE_FORMATS_KEY },
      update: { value: JSON.stringify(messageFormats) },
      create: {
        key: MESSAGE_FORMATS_KEY,
        value: JSON.stringify(messageFormats),
      },
    });

    return NextResponse.json({
      messageFormats: parseMessageFormats(setting.value),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
