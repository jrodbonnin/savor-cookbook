import { stripeClient, priceId } from '@/lib/billing/stripe';
import { processBillingEvent } from '@/lib/billing/engine.mjs';
import { billingStore } from '@/lib/billing/repository';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith('whsec_')) return Response.json({ error: 'Webhook signing is not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  // Read exact bytes before JSON parsing: Stripe signs the raw request body.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Missing webhook payload.' }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 1000000) { await reader.cancel(); return Response.json({ error: 'Payload too large.' }, { status: 413 }); }
    chunks.push(value);
  }
  let stripe;
  try { stripe = stripeClient(); }
  catch { return Response.json({ error: 'Stripe Sandbox configuration is unavailable.' }, { status: 503 }); }
  let event;
  try { event = stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, secret); }
  catch { return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 }); }
  if (event.livemode !== false) return Response.json({ error: 'Only Stripe Sandbox events are accepted.' }, { status: 400 });
  try {
    const result = await processBillingEvent(event, { stripe, store: billingStore, priceId: priceId() });
    return Response.json({ received: true, ...result });
  } catch {
    // Stripe retries 5xx responses. Never acknowledge an unsuccessful DB write
    // as processed, and never log payloads, signatures, or provider errors.
    console.error('[savor-billing] Webhook processing failed; retry required.');
    return Response.json({ error: 'Webhook could not be processed. Retry required.' }, { status: 503 });
  }
}
