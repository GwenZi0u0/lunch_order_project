import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { signJWT, getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Fetch user from DB to get the latest balance and details
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    });

    if (!dbUser) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, user: dbUser });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'logout') {
      const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
      response.cookies.set('session-token', '', {
        path: '/',
        expires: new Date(0),
        httpOnly: true,
      });
      return response;
    }

    if (action === 'developer_login') {
      const { role, userType } = body;
      let email = '';
      let name = '';
      let initialBalance = 0;
      let avatarUrl = '';

      if (role === 'admin') {
        email = 'admin@kaizen.com';
        name = '管理員 Admin';
        avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces';
      } else {
        // user
        if (userType === 'positive') {
          email = 'xiaohua@kaizen.com';
          name = '張小華 (餘額充足)';
          initialBalance = 250;
          avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces';
        } else if (userType === 'negative') {
          email = 'datong@kaizen.com';
          name = '王大同 (欠款警示)';
          initialBalance = -80;
          avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces';
        } else {
          // neutral
          email = 'minghui@kaizen.com';
          name = '李明輝 (餘額歸零)';
          initialBalance = 0;
          avatarUrl = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces';
        }
      }

      // Upsert user in the database
      const dbUser = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          role,
          avatarUrl,
        },
        create: {
          email,
          name,
          role,
          balance: initialBalance,
          avatarUrl,
        }
      });

      // Generate JWT token
      const token = await signJWT({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role
      });

      const response = NextResponse.json({
        success: true,
        user: dbUser,
        message: 'Developer login successful'
      });

      // Set cookie
      response.cookies.set('session-token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
