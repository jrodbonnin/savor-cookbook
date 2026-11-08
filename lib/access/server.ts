import 'server-only';
import { getAuth } from '@/lib/auth/server';
import { resolveDemoEntitlement } from './demo-policy.mjs';
import { subscriptionsForUser } from '@/lib/billing/repository';
import { subscriptionHasPremium } from '@/lib/billing/policy.mjs';

/**
 * The single entry point for future Premium gates in server actions and APIs.
 * It accepts no caller-supplied user identity and never trusts client metadata.
 * The demo entitlement is an application grant, not a Stripe subscription.
 */
export async function getCurrentEntitlements() {
  const { data, error } = await getAuth().getSession({ query: { disableCookieCache: true } });
  if (error) throw new Error('Unable to verify your session for access checks.');
  const entitlement = resolveDemoEntitlement(data?.user?.id, process.env.SAVOR_DEMO_USER_ID);
  if (entitlement.plan === 'premium') return { ...entitlement, hasPremiumAccess: true };
  if (data?.user && (await subscriptionsForUser(data.user.id)).some(record => subscriptionHasPremium(record))) {
    return { plan: 'premium' as const, source: 'stripe' as const, hasPremiumAccess: true };
  }
  return { ...entitlement, hasPremiumAccess: false };
}

export async function requirePremiumAccess() {
  const entitlement = await getCurrentEntitlements();
  if (!entitlement.hasPremiumAccess) throw new Error('Premium access is required.');
  return entitlement;
}
