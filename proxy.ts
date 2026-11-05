import { getAuth } from '@/lib/auth/server';
import type { NextRequest } from 'next/server';
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: '/login' })(request);
}
export const config = { matcher: ['/dashboard/:path*'] };
