import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import prisma from '@/lib/db';
import { getViewerPage } from '@/lib/adminPermissions';

export default async function IndexPage() {
  const cookieStore = cookies();
  const tokenCookie = cookieStore.get('session-token');
  
  if (!tokenCookie) {
    redirect('/login');
  }

  const payload = await verifyJWT(tokenCookie.value);
  if (!payload) {
    redirect('/login');
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, viewerPage: true }
  });

  if (currentUser?.role === 'admin') {
    redirect('/admin');
  } else if (currentUser?.role === 'viewer') {
    redirect(getViewerPage(currentUser.viewerPage)?.href || '/portal');
  } else {
    redirect('/portal');
  }
}
