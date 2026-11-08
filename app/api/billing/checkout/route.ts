import { requireUser, sameOrigin, json, handle } from '@/lib/recipes/http';
import { startCheckout } from '@/lib/billing/checkout';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const userId = await requireUser();
    return json(await startCheckout(userId));
  });
}
