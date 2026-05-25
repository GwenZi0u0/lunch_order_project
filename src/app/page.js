import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';

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

  if (payload.role === 'admin') {
    redirect('/admin');
  } else {
    redirect('/portal');
  }
}
