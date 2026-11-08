import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { resolveDemoEntitlement } from '../lib/access/demo-policy.mjs';
import { BILLING_EVENTS, blocksNewCheckout, subscriptionHasPremium, validPremiumPrice, snapshotSubscription, subscriptionIdForEvent } from '../lib/billing/policy.mjs';
import { processBillingEvent } from '../lib/billing/engine.mjs';
const priceId = 'price_unit_fixture';
const price = { id: priceId, active: true, livemode: false, type: 'recurring', currency: 'usd', unit_amount: 799, recurring: { interval: 'month', interval_count: 1 } };
function subscription(overrides = {}) {
  return { id: 'sub_unit_fixture', customer: 'cus_unit_fixture', livemode: false, metadata: { neon_user_id: 'neon-user-fixture' }, status: 'active', pause_collection: null,
    cancel_at_period_end: false, items: { data: [{ quantity: 1, price, current_period_end: Math.floor(Date.now()/1000) + 86400 }] }, latest_invoice: { status: 'paid' }, ...overrides };
}
function event(type = 'invoice.paid', id = 'evt_unit_fixture') {
  return { id, type, livemode: false, data: { object: { id: 'in_unit_fixture', customer: 'cus_unit_fixture', parent: { subscription_details: { subscription: 'sub_unit_fixture' } } } } };
}
function harness(initial = subscription()) {
  const seen = new Set(); let locked = false; let current = initial; let writes = 0; let reads = 0; let fail = false; let snapshot = null;
  const store = {
    async findCustomer(id) { return id === 'cus_unit_fixture' ? { userId: 'neon-user-fixture', customerId: id } : null; },
    async eventProcessed(id) { return seen.has(id); },
    async acquire() { if (locked) return null; locked = true; return 'fixture-lease'; },
    async release() { locked = false; },
    async apply(e, value) { if (fail) throw new Error('Simulated DB outage'); writes++; snapshot = value; seen.add(e.id); return true; },
  };
  const stripe = { subscriptions: { async retrieve() { reads++; return current; } }, checkout: { sessions: { async retrieve() { return { id: 'cs_unit_fixture', customer: 'cus_unit_fixture', livemode: false, mode: 'subscription', client_reference_id: 'neon-user-fixture', metadata: { neon_user_id: 'neon-user-fixture' }, subscription: 'sub_unit_fixture' }; } } } };
  return { deps: { stripe, store, priceId }, setCurrent(v) { current = v; }, setFail(v) { fail = v; }, lock() { locked = true; }, get writes() { return writes; }, get reads() { return reads; }, get snapshot() { return snapshot; }, seen };
}
test('only the fixed test-mode $7.99 USD monthly Price is valid', () => {
  assert.equal(validPremiumPrice(price, priceId, true), true);
  for (const change of [{livemode:true},{unit_amount:800},{currency:'eur'},{id:'price_other'},{active:false},{recurring:{interval:'year',interval_count:1}}]) assert.equal(validPremiumPrice({...price,...change},priceId,true),false);
});
test('Premium requires active, paid, unpaused, unexpired, validated subscription state', () => {
  const base = snapshotSubscription(subscription(), 'neon-user-fixture', 'cus_unit_fixture', priceId);
  assert.equal(subscriptionHasPremium(base), true);
  for (const change of [{status:'past_due'},{status:'canceled'},{status:'trialing'},{invoiceStatus:'open'},{priceValid:false},{paused:true},{periodEnd:0}]) assert.equal(subscriptionHasPremium({...base,...change}),false);
  assert.equal(subscriptionHasPremium({...base,cancelAtPeriodEnd:true}),true);
});
test('metadata, customer identity, quantity, and price cannot be swapped', () => {
  assert.throws(()=>snapshotSubscription(subscription({metadata:{neon_user_id:'another-user'}}),'neon-user-fixture','cus_unit_fixture',priceId));
  assert.throws(()=>snapshotSubscription(subscription({customer:'cus_other'}),'neon-user-fixture','cus_unit_fixture',priceId));
  const wrong = subscription({items:{data:[{quantity:2,price,current_period_end:9999999999}]}});
  assert.equal(subscriptionHasPremium(snapshotSubscription(wrong,'neon-user-fixture','cus_unit_fixture',priceId)),false);
});
test('non-terminal subscriptions prevent another checkout, including incomplete and past due', () => {
  for (const status of ['active','trialing','incomplete','past_due','unpaid','paused']) assert.equal(blocksNewCheckout(status),true);
  for (const status of ['canceled','incomplete_expired']) assert.equal(blocksNewCheckout(status),false);
});
test('Stripe signature verification rejects tampering, wrong secrets, and old signatures', () => {
  const stripe = new Stripe('unit-test-placeholder');
  const secret = randomBytes(32).toString('hex');
  const payload = JSON.stringify(event());
  const header = stripe.webhooks.generateTestHeaderString({payload,secret});
  assert.equal(stripe.webhooks.constructEvent(payload,header,secret).id,event().id);
  assert.throws(()=>stripe.webhooks.constructEvent(payload+' ',header,secret));
  assert.throws(()=>stripe.webhooks.constructEvent(payload,header,'different-secret'));
  const old = stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:Math.floor(Date.now()/1000)-1000});
  assert.throws(()=>stripe.webhooks.constructEvent(payload,old,secret));
});
test('duplicate deliveries write once and do not repeatedly call Stripe', async () => {
  const h=harness(); await processBillingEvent(event(),h.deps);const result=await processBillingEvent(event(),h.deps);
  assert.equal(result.duplicate,true);assert.equal(h.writes,1);assert.equal(h.reads,1);
});
test('checkout completion re-fetches state and never trusts a paid-looking event payload', async () => {
  const h=harness(subscription({status:'incomplete',latest_invoice:{status:'open'}}));
  const e=event('checkout.session.completed');e.data.object.id='cs_unit_fixture';e.data.object.payment_status='paid';
  await processBillingEvent(e,h.deps);assert.equal(subscriptionHasPremium(h.snapshot),false);
});
test('failed payment removes access and a later successful payment restores it', async () => {
  const h=harness(subscription({status:'past_due',latest_invoice:{status:'open'}}));
  await processBillingEvent(event('invoice.payment_failed','evt_failed'),h.deps);assert.equal(subscriptionHasPremium(h.snapshot),false);
  h.setCurrent(subscription());await processBillingEvent(event('invoice.paid','evt_paid'),h.deps);assert.equal(subscriptionHasPremium(h.snapshot),true);
});
test('old events use current Stripe state rather than restoring a canceled plan', async () => {
  const h=harness(subscription({status:'canceled'}));
  await processBillingEvent(event('invoice.paid','evt_delayed_old_paid'),h.deps);assert.equal(subscriptionHasPremium(h.snapshot),false);
});
test('database failure is retryable and does not mark the event processed', async () => {
  const h=harness();h.setFail(true);await assert.rejects(processBillingEvent(event(),h.deps));assert.equal(h.seen.size,0);
  h.setFail(false);await processBillingEvent(event(),h.deps);assert.equal(h.seen.size,1);
});
test('concurrent events cannot apply state while another customer lease is held', async () => {
  const h=harness();h.lock();await assert.rejects(processBillingEvent(event(),h.deps),/BILLING_BUSY/);assert.equal(h.writes,0);
});
test('unknown customers and live-mode events cannot provision accounts', async () => {
  const h=harness();const unknown=event();unknown.data.object.customer='cus_unknown';assert.equal((await processBillingEvent(unknown,h.deps)).ignored,true);assert.equal(h.writes,0);
  await assert.rejects(processBillingEvent({...event(),livemode:true},h.deps),/LIVE_EVENT_REJECTED/);
});
test('invoice event parsing supports current and older snapshot shapes', () => {
  assert.equal(subscriptionIdForEvent(event()),'sub_unit_fixture');
  const old=event();old.data.object={subscription:'sub_old'};assert.equal(subscriptionIdForEvent(old),'sub_old');
});
test('the demo entitlement remains independent of a canceled or missing Stripe subscription', () => {
  assert.equal(resolveDemoEntitlement('demo-immutable-id','demo-immutable-id').plan,'premium');
  assert.equal(subscriptionHasPremium(null),false);
  assert.equal(resolveDemoEntitlement('different-user','demo-immutable-id').plan,'free');
});
test('the registered event set includes renewals, failures, updates and cancellations', () => {
  for (const type of ['checkout.session.completed','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted']) assert.ok(BILLING_EVENTS.includes(type));
});

test('an expired fenced lease is not acknowledged as processed', async () => {
  const h=harness();h.deps.store.apply=async()=>false;
  await assert.rejects(processBillingEvent(event(),h.deps),/BILLING_LEASE_EXPIRED/);
  assert.equal(h.seen.size,0);
});
