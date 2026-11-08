import 'server-only';
import { randomUUID } from 'node:crypto';
import { stripeClient, priceId, verifyPrice, requireWebhookSetup, appOrigin } from './stripe';
import { billingStore, ensureBillingCustomer, getBillingCustomer, saveCustomerId, saveAttempt } from './repository';
import { blocksNewCheckout } from './policy.mjs';
import { RecipeError } from '@/lib/recipes/http';

export async function portalForCustomer(customerId: string) {
  const stripe = stripeClient();
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const config = configs.data.find(config => config.metadata?.application === 'savor' && config.features.subscription_cancel.enabled && config.features.subscription_cancel.mode === 'at_period_end' && config.features.payment_method_update.enabled && !config.features.subscription_update.enabled);
  if (!config) throw new RecipeError(503, 'PORTAL_NOT_CONFIGURED', 'The project owner must enable cancellation and payment-method updates in the Stripe Sandbox customer portal settings.');
  return stripe.billingPortal.sessions.create({ customer: customerId, configuration: config.id, return_url: `${appOrigin()}/billing` });
}
export async function startCheckout(userId: string) {
  // The demo grant is checked before any Stripe configuration or calls.
  if (userId === process.env.SAVOR_DEMO_USER_ID) return { demo: true, url: `${appOrigin()}/billing` };
  requireWebhookSetup();
  const fixedPrice = await verifyPrice();
  const stripe = stripeClient();
  await ensureBillingCustomer(userId);
  const token = await billingStore.acquire(userId);
  if (!token) throw new RecipeError(409, 'BILLING_BUSY', 'A billing request is already processing. Please wait a moment before trying again.');
  try {
    let mapping = await getBillingCustomer(userId);
    if (!mapping) throw new Error('Billing mapping missing');
    let customerId = mapping.customerId;
    if (!customerId) {
      // Recover an earlier customer if Stripe succeeded but the DB write failed.
      const escapedId = userId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const prior = await stripe.customers.search({ query: `metadata['neon_user_id']:'${escapedId}'`, limit: 2 });
      if (prior.data.length > 1) throw new RecipeError(409, 'BILLING_REVIEW', 'The project owner needs to review this account’s billing records before creating another subscription.');
      const customer = prior.data[0] || await stripe.customers.create({ metadata: { neon_user_id: userId } }, { idempotencyKey: `savor-customer-${userId}` });
      if (customer.livemode !== false || customer.metadata.neon_user_id !== userId) throw new Error('Billing identity mismatch');
      customerId = customer.id;
      await saveCustomerId(userId, token, customerId);
    }
    const existingCustomer = await stripe.customers.retrieve(customerId);
    if (existingCustomer.deleted || existingCustomer.livemode !== false || existingCustomer.metadata.neon_user_id !== userId) throw new RecipeError(409, 'BILLING_REVIEW', 'This account’s billing mapping needs the project owner’s attention.');
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some(subscription => blocksNewCheckout(subscription.status))) {
      return { existingSubscription: true, url: (await portalForCustomer(customerId)).url };
    }
    if (mapping.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(mapping.sessionId);
      if (session.customer !== customerId || session.metadata?.neon_user_id !== userId) throw new Error('Checkout mapping mismatch');
      if (session.status === 'open' && session.url) return { reused: true, url: session.url };
      if (session.status === 'complete') {
        const current = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
        if (current.data.some(subscription => blocksNewCheckout(subscription.status))) return { existingSubscription: true, url: (await portalForCustomer(customerId)).url };
        // A completed, canceled subscription can start a new checkout below.
      }
      const attempt = randomUUID();
      await saveAttempt(userId, token, attempt, appOrigin(), null);
      mapping = { ...mapping, attemptId: attempt, checkoutOrigin: appOrigin(), sessionId: null };
    }
    if (!mapping.attemptId) {
      const attempt = randomUUID();
      await saveAttempt(userId, token, attempt, appOrigin(), null);
      mapping = { ...mapping, attemptId: attempt, checkoutOrigin: appOrigin() };
    }
    // Recover an open session after a lost response/DB write. Customer-level
    // leases plus a persisted attempt UUID prevent concurrent double-clicks.
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    const reusable = open.data.find(session => session.mode === 'subscription' && session.metadata?.neon_user_id === userId);
    if (reusable?.url) {
      await saveAttempt(userId, token, mapping.attemptId!, mapping.checkoutOrigin!, reusable.id);
      return { reused: true, url: reusable.url };
    }
    if (open.has_more) throw new RecipeError(409, 'BILLING_REVIEW', 'Please ask the project owner to review pending checkout sessions.');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, client_reference_id: userId,
      line_items: [{ price: fixedPrice, quantity: 1 }], allowed_payment_method_types: ['card'], ui_mode: 'hosted_page',
      metadata: { neon_user_id: userId }, subscription_data: { metadata: { neon_user_id: userId } },
      success_url: `${mapping.checkoutOrigin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${mapping.checkoutOrigin}/billing/cancel`,
    }, { idempotencyKey: `savor-checkout-${userId}-${mapping.attemptId}-${priceId()}` });
    if (session.livemode || !session.url) throw new Error('Invalid test checkout session');
    await saveAttempt(userId, token, mapping.attemptId!, mapping.checkoutOrigin!, session.id);
    return { url: session.url };
  } finally { await billingStore.release(userId, token); }
}
