import { requireUser, sameOrigin, json, handle, RecipeError } from '@/lib/recipes/http';
import { getBillingCustomer } from '@/lib/billing/repository';
import { portalForCustomer } from '@/lib/billing/checkout';
import { appOrigin } from '@/lib/billing/stripe';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const userId = await requireUser();
    if (userId === process.env.SAVOR_DEMO_USER_ID) return json({ demo: true, url: `${appOrigin()}/billing` });
    const mapping = await getBillingCustomer(userId);
    if (!mapping?.customerId) throw new RecipeError(404, 'NO_BILLING_ACCOUNT', 'You do not have a Stripe billing account yet.');
    return json({ url: (await portalForCustomer(mapping.customerId)).url });
  });
}
