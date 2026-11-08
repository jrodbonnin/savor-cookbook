import 'server-only';
import Stripe from 'stripe';
import { validPremiumPrice } from './policy.mjs';
import { RecipeError } from '@/lib/recipes/http';
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith('sk_test_')) throw new RecipeError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe Sandbox is not configured. The project owner needs to check the test-mode key.');
  return new Stripe(key, { apiVersion: '2026-10-28.endive', timeout: 12000, maxNetworkRetries: 1, telemetry: false });
}
export function priceId() {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id?.startsWith('price_')) throw new RecipeError(503, 'PRICE_NOT_CONFIGURED', 'The Premium price needs to be configured by the project owner.');
  return id;
}
export function requireWebhookSetup() {
  if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) throw new RecipeError(503, 'WEBHOOK_NOT_CONFIGURED', 'Checkout will be available after the project owner finishes Stripe webhook setup.');
}
export async function verifyPrice() {
  const id = priceId();
  const price = await stripeClient().prices.retrieve(id);
  if (!validPremiumPrice(price, id, true)) throw new RecipeError(503, 'INVALID_PREMIUM_PRICE', 'The Stripe Sandbox price must be an active USD $7.99 monthly recurring price.');
  return id;
}
export function appOrigin() {
  const configured = process.env.SAVOR_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) throw new Error('Invalid application URL');
    return url.origin;
  }
  if (process.env.VERCEL_ENV === 'production') return 'https://savor-cookbook-delta.vercel.app';
  if (process.env.VERCEL_URL?.endsWith('.vercel.app')) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
