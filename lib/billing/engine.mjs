import { BILLING_EVENTS, objectId, subscriptionIdForEvent, snapshotSubscription } from './policy.mjs';
/**
 * Signature verification is performed by the route before calling this engine.
 * All payment state is re-fetched from Stripe under a per-customer DB lease;
 * event delivery order and success-page redirects never determine entitlement.
 * @param {import('stripe').default.Event} event
 * @param {{stripe: import('stripe').default, store: import('./types').BillingStore, priceId: string}} dependencies
 */
export async function processBillingEvent(event, { stripe, store, priceId }) {
  if (event.livemode !== false) throw new Error('LIVE_EVENT_REJECTED');
  if (!BILLING_EVENTS.includes(event.type)) return { ignored: true };
  if (await store.eventProcessed(event.id)) return { duplicate: true };
  const object = event.data.object;
  const customerId = objectId(object.customer);
  if (!customerId) return { ignored: true };
  const customer = await store.findCustomer(customerId);
  if (!customer) return { ignored: true };
  const token = await store.acquire(customer.userId);
  if (!token) throw new Error('BILLING_BUSY');
  try {
    if (await store.eventProcessed(event.id)) return { duplicate: true };
    let subscriptionId = subscriptionIdForEvent(event);
    if (event.type.startsWith('checkout.session.')) {
      const session = await stripe.checkout.sessions.retrieve(object.id);
      if (session.livemode !== false || session.mode !== 'subscription' || objectId(session.customer) !== customerId ||
          session.client_reference_id !== customer.userId || session.metadata?.neon_user_id !== customer.userId) {
        throw new Error('BILLING_IDENTITY_MISMATCH');
      }
      subscriptionId = objectId(session.subscription);
      if (event.type === 'checkout.session.expired' || !subscriptionId) return { ignored: true };
    }
    if (!subscriptionId) return { ignored: true };
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
    const snapshot = snapshotSubscription(subscription, customer.userId, customerId, priceId);
    if (!await store.apply(event, snapshot, token)) throw new Error('BILLING_LEASE_EXPIRED');
    return { processed: true };
  } finally { await store.release(customer.userId, token); }
}
