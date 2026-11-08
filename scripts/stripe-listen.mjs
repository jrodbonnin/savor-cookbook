// Local-only listener. The public endpoint has a different signing secret.
// Do not upload this CLI signing secret to Vercel Production.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, chmodSync } from 'node:fs';
import { BILLING_EVENTS } from '../lib/billing/policy.mjs';
try {
  process.loadEnvFile('.env.local');
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Test key required');
  const env = { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY };
  const prefix = ['--dir', '/private/tmp', 'dlx', '@stripe/cli'];
  const result = spawnSync('pnpm', [...prefix, 'listen', '--print-secret'], { env, encoding: 'utf8', timeout: 60000 });
  const secret = result.stdout?.match(/\bwhsec_[A-Za-z0-9]+\b/)?.[0];
  if (result.status !== 0 || !secret) throw new Error('Listener authentication failed');
  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== secret) {
    console.error('A different local webhook secret is already configured. Keep public and CLI secrets separate; update .env.local privately before starting this listener.');
    process.exit(1);
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Check the file as well as process.env before appending, preserving all values.
    if (/^STRIPE_WEBHOOK_SECRET=/m.test(readFileSync('.env.local', 'utf8'))) throw new Error('Existing webhook entry needs review');
    appendFileSync('.env.local', '\n# Stripe CLI listener only; not the public endpoint secret.\nSTRIPE_WEBHOOK_SECRET=' + JSON.stringify(secret) + '\n');
    chmodSync('.env.local', 0o600);
    console.log('Local Stripe CLI signing secret saved privately. Restart the local app if it does not reload environment changes.');
  }
  console.log('Starting Stripe Sandbox forwarding to http://localhost:3000/api/stripe/webhook. Keep this terminal open.');
  const child = spawn('pnpm', [...prefix, 'listen', '--events', BILLING_EVENTS.join(','), '--forward-to', 'http://localhost:3000/api/stripe/webhook'], { env, stdio: ['ignore','pipe','pipe'] });
  let ready = false;
  const observe = chunk => {
    const text = chunk.toString();
    if (!ready && /Ready|ready/.test(text)) { ready = true; console.log('Stripe Sandbox webhook listener is ready. Raw CLI output and signing secrets are suppressed.'); }
    for (const type of BILLING_EVENTS) if (text.includes(type)) console.log('Stripe test notification: ' + type);
    if (/\[50[0-9]\]/.test(text)) console.log('A forwarded webhook returned 5xx; check local billing configuration.');
  };
  child.stdout.on('data', observe); child.stderr.on('data', observe);
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('exit', code => { console.log('Stripe listener stopped.'); process.exitCode = code || 0; });
} catch {
  console.error('Local Stripe listener setup failed. Check the test API key and network connection. No secret values were printed.');
  process.exitCode = 1;
}
