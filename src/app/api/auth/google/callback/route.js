import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { signJWT } from '@/lib/auth';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function getBaseUrl(request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function redirectToLogin(request, message) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange Google code');
  }

  return data;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profile = await response.json();
  if (!response.ok) {
    throw new Error(profile.error_description || profile.error || 'Failed to fetch Google profile');
  }

  if (!profile.email || !profile.email_verified) {
    throw new Error('Google account email is not verified');
  }

  return profile;
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = request.cookies.get('google-oauth-state')?.value;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectToLogin(request, 'Google OAuth environment variables are missing');
  }

  if (!code) {
    return redirectToLogin(request, url.searchParams.get('error') || 'Google login was cancelled');
  }

  if (!state || !savedState || state !== savedState) {
    return redirectToLogin(request, 'Invalid Google OAuth state');
  }

  try {
    const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
    const token = await exchangeCodeForToken({ code, redirectUri });
    const profile = await fetchGoogleProfile(token.access_token);

    const dbUser = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name || profile.email,
        avatarUrl: profile.picture,
      },
      create: {
        email: profile.email,
        name: profile.name || profile.email,
        avatarUrl: profile.picture,
        role: 'user',
        balance: 0,
      },
    });

    const sessionToken = await signJWT({
      userId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    });

    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('session-token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set('google-oauth-state', '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
    });

    return response;
  } catch (error) {
    return redirectToLogin(request, error.message || 'Google login failed');
  }
}
