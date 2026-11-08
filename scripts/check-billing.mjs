// Explicit opt-in only: creates one new Neon test user, Stripe Sandbox customer,
// Checkout Session, and a test subscription paid with Stripe's tok_visa fixture.
// The new test subscription is canceled. No existing users or plans are changed.
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
process.loadEnvFile('.env.local');
if (process.env.RUN_STRIPE_SANDBOX_CHECK !== 'yes' || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || !process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
  console.error('Explicit Sandbox test opt-in, a test API key, and local webhook listener are required.');process.exit(2);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-10-28.endive',maxNetworkRetries:0});
const sql = neon(process.env.DATABASE_URL);
const base = 'http://localhost:3000';let cookie,subscriptionId,sessionId;
async function api(path,body,origin=base) {
  const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {response:r,data:await r.json().catch(()=>null),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
function check(value,label){assert.ok(value,label);console.log('PASS '+label);}
async function waitFor(predicate,label){for(let i=0;i<30;i++){const status=await api('/api/billing/status');if(predicate(status.data)){console.log('PASS '+label);return;}await new Promise(resolve=>setTimeout(resolve,1000));}throw Error(label);}
try{
  check((await api('/api/billing/checkout',{})).response.status===401,'anonymous checkout rejected');
  const signup=await api('/api/auth/sign-up/email',{name:'Savor Stripe Sandbox verification',email:`savor-billing-${randomBytes(8).toString('hex')}@example.com`,password:randomBytes(24).toString('base64url')+'aA9!'});
  check(signup.response.ok,'separate billing test identity created through normal auth');cookie=signup.cookie;const userId=signup.data.user.id;
  check((await api('/api/billing/checkout',{},'https://untrusted.example')).response.status===403,'cross-origin checkout rejected');
  const invalidSignature=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':'invalid'},body:'{}'});
  check(invalidSignature.status===400,'unsigned or invalidly signed webhook rejected');
  const first=await api('/api/billing/checkout',{});
  if(!first.response.ok)console.log('Checkout diagnostic:',first.response.status,first.data?.code);
  check(first.response.ok&&new URL(first.data.url).hostname==='checkout.stripe.com','real test-mode Checkout Session created');
  const second=await api('/api/billing/checkout',{});check(second.data?.url===first.data.url,'repeated checkout reuses the pending session');
  const mapping=(await sql`SELECT stripe_customer_id,checkout_session_id FROM savor.billing_customers WHERE user_id=${userId}`)[0];sessionId=mapping.checkout_session_id;
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  check(session.livemode===false&&session.mode==='subscription'&&session.client_reference_id===userId&&session.metadata.neon_user_id===userId,'Checkout is associated with the immutable Neon identity in Sandbox');
  const items=await stripe.checkout.sessions.listLineItems(sessionId);check(items.data[0]?.price?.id===process.env.STRIPE_PRICE_ID&&items.data[0].quantity===1,'server uses the configured recurring price and one unit');
  const success=await fetch(base+'/billing/success?session_id=not-a-real-session',{headers:{Cookie:cookie}});check(success.status===200&&(await api('/api/billing/status')).data.hasPremiumAccess===false,'success-page visits do not grant Premium');
  await stripe.checkout.sessions.expire(sessionId);sessionId=null;
  const paymentMethod=await stripe.paymentMethods.create({type:'card',card:{token:'tok_visa'}});
  await stripe.paymentMethods.attach(paymentMethod.id,{customer:mapping.stripe_customer_id});
  const subscription=await stripe.subscriptions.create({customer:mapping.stripe_customer_id,items:[{price:process.env.STRIPE_PRICE_ID}],default_payment_method:paymentMethod.id,metadata:{neon_user_id:userId},payment_behavior:'error_if_incomplete'});
  subscriptionId=subscription.id;check(subscription.livemode===false,'only a Stripe Sandbox test subscription was created');
  await waitFor(status=>status?.hasPremiumAccess===true&&status.source==='stripe','real signed Stripe notifications grant Premium in Neon');
  const portal=await api('/api/billing/portal',{});check(portal.response.ok&&new URL(portal.data.url).hostname==='billing.stripe.com','authenticated customer portal works');
  const duplicate=await api('/api/billing/checkout',{});check(duplicate.data?.existingSubscription===true&&new URL(duplicate.data.url).hostname==='billing.stripe.com','an existing subscription goes to the portal instead of a duplicate checkout');
  const processed=await sql`SELECT e.event_id FROM savor.stripe_events e WHERE e.customer_id=${mapping.stripe_customer_id} LIMIT 1`;
  check(processed.length===1,'verified event IDs are persisted for deduplication');
  const realEvent=await stripe.events.retrieve(processed[0].event_id);const payload=JSON.stringify(realEvent);const signature=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
  const duplicateEvent=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':signature},body:payload});const result=await duplicateEvent.json();check(duplicateEvent.ok&&result.duplicate===true,'a replayed signed event is acknowledged without reprocessing');
  await stripe.subscriptions.update(subscriptionId,{cancel_at_period_end:true});
  await waitFor(status=>status?.hasPremiumAccess===true&&status.subscription?.cancelAtPeriodEnd===true,'scheduled cancellation retains access through the paid period');
  await stripe.subscriptions.cancel(subscriptionId);subscriptionId=null;
  await waitFor(status=>status?.hasPremiumAccess===false&&status.subscription?.status==='canceled','signed cancellation removes subscription Premium');
  console.log('Sandbox cycle verified. New test identity and Stripe history retained; no real charges or existing-user changes.');
}catch(error){console.error('FAIL',error instanceof assert.AssertionError||error?.constructor===Error?error.message:'Sandbox integration operation failed; provider details omitted');process.exitCode=1;}
finally{
  if(subscriptionId)await stripe.subscriptions.cancel(subscriptionId).catch(()=>console.error('The newly created test subscription needs manual cancellation.'));
  if(sessionId)await stripe.checkout.sessions.expire(sessionId).catch(()=>{});
  if(cookie)await api('/api/auth/sign-out',{}).catch(()=>{});
}
