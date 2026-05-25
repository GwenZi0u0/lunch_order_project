import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'lunch-kaizen-secret-key-default-12345678-xyz'
);

export async function signJWT(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyJWT(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(request) {
  let token = null;

  // Try extracting from cookies (standard for nextjs requests)
  if (request.cookies && typeof request.cookies.get === 'function') {
    const cookie = request.cookies.get('session-token');
    if (cookie) token = cookie.value;
  }

  // Fallback: request header (for other APIs)
  if (!token && request.headers && typeof request.headers.get === 'function') {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return await verifyJWT(token);
}
