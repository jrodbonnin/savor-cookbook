import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

// Lazy initialization lets the public homepage build without auth credentials.
export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) {
    throw new Error('Neon Auth is not configured. Set NEON_AUTH_BASE_URL and a NEON_AUTH_COOKIE_SECRET of at least 32 characters on the server.');
  }
  return createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 60 } });
}
