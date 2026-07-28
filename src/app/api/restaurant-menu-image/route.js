import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const MENU_IMAGE_KEY_PREFIX = 'restaurantMenuImage:';

export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get('restaurantId');
  if (!restaurantId) {
    return new Response('Restaurant ID is required', { status: 400 });
  }

  const setting = await prisma.siteSetting.findUnique({
    where: { key: `${MENU_IMAGE_KEY_PREFIX}${restaurantId}` }
  });
  if (!setting) {
    return new Response('Menu image not found', { status: 404 });
  }

  const match = setting.value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!match) {
    return new Response('Invalid menu image', { status: 500 });
  }

  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
