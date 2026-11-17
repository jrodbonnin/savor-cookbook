import { getAuth } from '@/lib/auth/server';
import { GOOGLE_ERROR_PATH, googleAuthEnabled } from '@/lib/auth/google';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  let destination = GOOGLE_ERROR_PATH;
  if (googleAuthEnabled(process.env.SAVOR_GOOGLE_AUTH_ENABLED) &&
      !request.nextUrl.searchParams.has('neon_auth_session_verifier')) {
    const session = await getAuth().getSession({ query: { disableCookieCache: true } });
    if (!session.error && session.data?.user && session.data.session) {
      destination = '/dashboard';
    }
  }
  return NextResponse.redirect(new URL(destination, request.url), {
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
