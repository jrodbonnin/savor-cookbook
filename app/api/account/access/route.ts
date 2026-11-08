import { getCurrentEntitlements } from '@/lib/access/server';
export const dynamic = 'force-dynamic';

// No query, body, email, or role from the browser can change this decision.
export async function GET() {
  const entitlement = await getCurrentEntitlements();
  return Response.json(entitlement, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
