import { getAuth } from '@/lib/auth/server';
import { GOOGLE_CALLBACK_PATH, GOOGLE_ERROR_PATH, googleAuthEnabled } from '@/lib/auth/google';
import { NextResponse, type NextRequest } from 'next/server';

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === GOOGLE_CALLBACK_PATH) {
    const errorUrl = new URL(GOOGLE_ERROR_PATH, request.url);
    if (!googleAuthEnabled(process.env.SAVOR_GOOGLE_AUTH_ENABLED)) {
      return NextResponse.redirect(errorUrl);
    }
    const response = await getAuth().middleware({ loginUrl: GOOGLE_ERROR_PATH })(request);
    const location = response.headers.get('location');
    if (location && new URL(location, request.url).pathname === errorUrl.pathname) {
      // Neon copies query parameters on failure. Keep the verifier off the login page.
      response.headers.set('location', errorUrl.href);
    }
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  return getAuth().middleware({ loginUrl: '/login' })(request);
}
export const config = { matcher: ['/dashboard/:path*', '/auth/callback/google'] };
