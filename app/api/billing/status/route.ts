import { requireUser, json, handle } from '@/lib/recipes/http';
import { getCurrentEntitlements } from '@/lib/access/server';
import { subscriptionsForUser } from '@/lib/billing/repository';
export const dynamic = 'force-dynamic';
export async function GET() {
  return handle(async () => {
    const userId = await requireUser();
    const entitlement = await getCurrentEntitlements();
    // Demo access works independently of Stripe billing records.
    if (entitlement.source === 'demo') return json({ ...entitlement, subscription: null, checkoutReady: false });
    const subscriptions = await subscriptionsForUser(userId);
    const subscription = subscriptions.find(s => s.status === 'active') || subscriptions.find(s => !['canceled','incomplete_expired'].includes(s.status)) || subscriptions[0];
    return json({ ...entitlement,
      subscription: subscription ? { status: subscription.status, periodEnd: subscription.periodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd } : null,
      checkoutReady: !!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && !!process.env.STRIPE_PRICE_ID && !!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'),
    });
  });
}
