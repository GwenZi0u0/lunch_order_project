import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canReadAdminData } from '@/lib/adminPermissions';

const JSON_EXAMPLES_KEY = 'admin_restaurant_json_examples';

function normalizeExamples(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: typeof item.id === 'string' && item.id ? item.id : `json-example-${Date.now()}-${index}`,
    title: typeof item.title === 'string' ? item.title.trim() : '',
    content: typeof item.content === 'string' ? item.content.trim() : '',
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
  })).filter(item => item.title && item.content);
}

function parseExamples(value) {
  if (!value) return [];
  try {
    return normalizeExamples(JSON.parse(value));
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!canReadAdminData(user, ['restaurants'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const setting = await prisma.siteSetting.findUnique({ where: { key: JSON_EXAMPLES_KEY } });
    return NextResponse.json({ examples: parseExamples(setting?.value) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const examples = normalizeExamples(body.examples);
    const setting = await prisma.siteSetting.upsert({
      where: { key: JSON_EXAMPLES_KEY },
      update: { value: JSON.stringify(examples) },
      create: { key: JSON_EXAMPLES_KEY, value: JSON.stringify(examples) }
    });
    return NextResponse.json({ examples: parseExamples(setting.value) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
