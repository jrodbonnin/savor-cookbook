import 'server-only';
import { randomUUID } from 'node:crypto';
import { database } from '@/lib/recipes/db';
import type { BillingCustomer, BillingStore, SubscriptionSnapshot } from './types';
function customer(row: Record<string, unknown>): BillingCustomer {
  return { userId: String(row.user_id), customerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    sessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
    attemptId: row.checkout_attempt_id ? String(row.checkout_attempt_id) : null,
    checkoutOrigin: row.checkout_origin ? String(row.checkout_origin) : null };
}
export async function getBillingCustomer(userId: string) {
  const rows = await database()`SELECT * FROM savor.billing_customers WHERE user_id=${userId}`;
  return rows[0] ? customer(rows[0]) : null;
}
export async function ensureBillingCustomer(userId: string) {
  await database()`INSERT INTO savor.billing_customers (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
}
export async function saveCustomerId(userId: string, token: string, customerId: string) {
  const rows = await database()`UPDATE savor.billing_customers SET stripe_customer_id=${customerId},updated_at=now()
    WHERE user_id=${userId} AND lease_token=${token} AND lease_until>now() RETURNING user_id`;
  if (!rows.length) throw new Error('BILLING_LEASE_EXPIRED');
}
export async function saveAttempt(userId: string, token: string, attempt: string, origin: string, sessionId: string | null) {
  const rows = await database()`UPDATE savor.billing_customers SET checkout_attempt_id=${attempt},checkout_origin=${origin},checkout_session_id=${sessionId},updated_at=now()
    WHERE user_id=${userId} AND lease_token=${token} AND lease_until>now() RETURNING user_id`;
  if (!rows.length) throw new Error('BILLING_LEASE_EXPIRED');
}
export async function subscriptionsForUser(userId: string): Promise<SubscriptionSnapshot[]> {
  const rows = await database()`SELECT * FROM savor.subscriptions WHERE user_id=${userId} ORDER BY verified_at DESC`;
  return rows.map(row => ({ id: String(row.stripe_subscription_id), userId, customerId: String(row.stripe_customer_id),
    priceId: row.price_id, status: row.status, periodEnd: row.current_period_end ? new Date(row.current_period_end).getTime()/1000 : null,
    cancelAtPeriodEnd: row.cancel_at_period_end, invoiceStatus: row.latest_invoice_status,
    priceValid: row.price_valid, paused: row.paused }));
}
export const billingStore: BillingStore = {
  async findCustomer(customerId) {
    const rows = await database()`SELECT * FROM savor.billing_customers WHERE stripe_customer_id=${customerId}`;
    return rows[0] ? customer(rows[0]) : null;
  },
  async eventProcessed(id) {
    return (await database()`SELECT 1 FROM savor.stripe_events WHERE event_id=${id}`).length > 0;
  },
  async acquire(userId) {
    const token = randomUUID();
    const rows = await database()`UPDATE savor.billing_customers SET lease_token=${token},lease_until=now()+interval '90 seconds'
      WHERE user_id=${userId} AND (lease_until IS NULL OR lease_until<now()) RETURNING user_id`;
    return rows.length ? token : null;
  },
  async release(userId, token) {
    await database()`UPDATE savor.billing_customers SET lease_token=NULL,lease_until=NULL WHERE user_id=${userId} AND lease_token=${token}`;
  },
  async apply(event, snapshot, token) {
    const sql = database();
    const result = await sql`WITH owner AS MATERIALIZED (
      SELECT user_id FROM savor.billing_customers WHERE user_id=${snapshot.userId} AND stripe_customer_id=${snapshot.customerId}
        AND lease_token=${token} AND lease_until>clock_timestamp() FOR UPDATE
    ), written AS (
      INSERT INTO savor.subscriptions (stripe_subscription_id,user_id,stripe_customer_id,price_id,status,current_period_end,cancel_at_period_end,latest_invoice_status,price_valid,paused)
      SELECT ${snapshot.id},${snapshot.userId},${snapshot.customerId},${snapshot.priceId},${snapshot.status},
        ${snapshot.periodEnd ? new Date(snapshot.periodEnd*1000).toISOString() : null}::timestamptz,${snapshot.cancelAtPeriodEnd},${snapshot.invoiceStatus},${snapshot.priceValid},${snapshot.paused}
      FROM owner WHERE true
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET status=EXCLUDED.status,price_id=EXCLUDED.price_id,current_period_end=EXCLUDED.current_period_end,
        cancel_at_period_end=EXCLUDED.cancel_at_period_end,latest_invoice_status=EXCLUDED.latest_invoice_status,price_valid=EXCLUDED.price_valid,paused=EXCLUDED.paused,verified_at=now()
      WHERE savor.subscriptions.user_id=EXCLUDED.user_id AND savor.subscriptions.stripe_customer_id=EXCLUDED.stripe_customer_id RETURNING stripe_subscription_id
    ) INSERT INTO savor.stripe_events (event_id,event_type,customer_id)
      SELECT ${event.id},${event.type},${snapshot.customerId} FROM written
      ON CONFLICT (event_id) DO NOTHING RETURNING event_id`;
    return result.length === 1;
  },
};
