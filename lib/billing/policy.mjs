export const BILLING_EVENTS = [
  'checkout.session.completed', 'checkout.session.expired',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
];
export const STRIPE_API_VERSION = '2026-10-28.endive';
export function objectId(value) {
  return typeof value === 'string' ? value : value && typeof value.id === 'string' ? value.id : null;
}
export function subscriptionIdForEvent(event) {
  const object = event.data.object;
  if (event.type.startsWith('customer.subscription.')) return object.id;
  if (event.type.startsWith('checkout.session.')) return objectId(object.subscription);
  if (event.type.startsWith('invoice.')) return objectId(object.parent?.subscription_details?.subscription) || objectId(object.subscription);
  return null;
}
export function validPremiumPrice(price, expectedId, requireActive = false) {
  return !!price && price.id === expectedId && price.livemode === false &&
    (!requireActive || price.active === true) && price.type === 'recurring' &&
    price.currency === 'usd' && price.unit_amount === 799 && price.recurring?.interval === 'month' &&
    price.recurring?.interval_count === 1;
}
/** @param {import('./types').SubscriptionSnapshot | null} snapshot */
export function subscriptionHasPremium(snapshot, now = Date.now() / 1000) {
  return !!snapshot && snapshot.status === 'active' && snapshot.invoiceStatus === 'paid' &&
    snapshot.priceValid === true && snapshot.paused === false &&
    typeof snapshot.periodEnd === 'number' && snapshot.periodEnd > now;
}
export function blocksNewCheckout(status) {
  return !['canceled', 'incomplete_expired'].includes(status);
}
/** @returns {import('./types').SubscriptionSnapshot} */
export function snapshotSubscription(subscription, userId, customerId, priceId) {
  if (subscription.livemode !== false || objectId(subscription.customer) !== customerId || subscription.metadata?.neon_user_id !== userId) {
    throw new Error('BILLING_IDENTITY_MISMATCH');
  }
  const items = subscription.items?.data || [];
  const item = items.find(item => item.price?.id === priceId);
  const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
  return {
    id: subscription.id, userId, customerId, priceId: item?.price?.id || null,
    status: subscription.status,
    periodEnd: item?.current_period_end ?? subscription.current_period_end ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    invoiceStatus: invoice?.status || null,
    priceValid: items.length === 1 && item?.quantity === 1 && validPremiumPrice(item.price, priceId),
    paused: subscription.pause_collection != null,
  };
}
