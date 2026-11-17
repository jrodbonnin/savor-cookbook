import { getAuth } from '@/lib/auth/server';
import { googleAuthEnabled, isGoogleSignInRequest } from '@/lib/auth/google';
import type { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const authSegment = /^[a-z0-9-]+$/;

function linkingUnavailable() {
  return Response.json({ code: 'ACCOUNT_LINKING_UNAVAILABLE', message: 'Connecting Google to an existing account is temporarily unavailable.' }, {
    status: 403,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  if (path.join('/') === 'link-social') return linkingUnavailable();
  if (!path.every((segment) => authSegment.test(segment)) || path.join('/') === 'callback/google') {
    return new Response(null, { status: 404 });
  }
  return getAuth().handler().GET(request, context);
}
export async function POST(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const endpoint = path.join('/');
  if (endpoint === 'link-social') return linkingUnavailable();
  if (!path.every((segment) => authSegment.test(segment)) || endpoint === 'callback/google') {
    return new Response(null, { status: 404 });
  }
  if (endpoint === 'sign-in/social') {
    if (!googleAuthEnabled(process.env.SAVOR_GOOGLE_AUTH_ENABLED)) {
      return Response.json({ code: 'SOCIAL_SIGN_IN_DISABLED', message: 'Google sign-in is unavailable.' }, { status: 403 });
    }
    const body: unknown = await request.clone().json().catch(() => null);
    if (!isGoogleSignInRequest(body)) {
      return Response.json({ code: 'INVALID_SOCIAL_SIGN_IN', message: 'Invalid Google sign-in request.' }, { status: 400 });
    }
  }
  return getAuth().handler().POST(request, context);
}
