import Stripe from 'stripe';
try {
  try { process.loadEnvFile('.env.local'); } catch { /* Environment may already be configured. */ }
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Test Stripe key required');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-10-28.endive', maxNetworkRetries: 1 });
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const existing = configurations.data.find(c => c.metadata?.application === 'savor' && c.features.subscription_cancel.enabled && c.features.payment_method_update.enabled);
  if (!existing) await stripe.billingPortal.configurations.create({
    name: 'Savor Sandbox membership management', metadata: { application: 'savor' },
    business_profile: { headline: 'Manage your Savor Premium membership' },
    features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' }, subscription_update: { enabled: false } },
  }, { idempotencyKey: 'savor-sandbox-portal-config-v1' });
  console.log('Savor Sandbox customer portal is configured for payment-method updates, invoices, and end-of-period cancellation.');
} catch { console.error('Sandbox portal setup failed. Check the test Stripe key and portal permissions; no credentials printed.'); process.exitCode = 1; }
