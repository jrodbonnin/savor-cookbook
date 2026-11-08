'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, CreditCard, Leaf, LoaderCircle, ShieldCheck } from 'lucide-react';
type Status = {
  plan: 'free' | 'premium'; source: 'none' | 'demo' | 'stripe'; hasPremiumAccess: boolean; checkoutReady: boolean;
  subscription: { status: string; periodEnd: number | null; cancelAtPeriodEnd: boolean } | null;
};
export function BillingPanel({ compact = false, success = false }: { compact?: boolean; success?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/billing/status', { cache: 'no-store' });
      if (response.status === 401) { setAnonymous(true); setStatus(null); return; }
      if (!response.ok) throw new Error('Your billing status is temporarily unavailable. Please refresh it before starting checkout.');
      setStatus(await response.json()); setAnonymous(false); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not check your membership.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    if (!success) return;
    // Poll only our verified DB status, never the session_id query parameter.
    let polls = 0;
    const timer = setInterval(() => { void load(); if (++polls >= 15) clearInterval(timer); }, 2000);
    return () => clearInterval(timer);
  }, [load, success]);
  async function action(kind: 'checkout' | 'portal') {
    if (busy) return;
    if (anonymous) { window.location.assign('/login'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/billing/${kind}`, { method: 'POST' });
      const result = await response.json();
      if (response.status === 401) { window.location.assign('/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Billing is temporarily unavailable. Please try again.');
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not reach billing. Please try again.'); }
    finally { setBusy(false); }
  }
  const demo = status?.source === 'demo';
  const active = status?.hasPremiumAccess;
  const hasPlan = status?.subscription && !['canceled','incomplete_expired'].includes(status.subscription.status);
  return <section className={`premium-card ${compact ? 'premium-compact' : ''}`} aria-label="Savor Premium membership">
    <div className="premium-copy"><div className="eyebrow"><Leaf size={14}/> A LITTLE MORE SAVOR</div><h2>Savor <em>Premium.</em></h2><p>A membership for your everyday cooking companion. Keep your inspiration close and your cookbook personal.</p><div className="premium-price">$7.99<span> / month · USD</span></div><ul><li><Check size={15}/> A Premium account for Savor</li><li><Check size={15}/> Your private cookbook and AI recipe organization</li><li><Check size={15}/> Manage or cancel your plan through Stripe</li></ul><p className="premium-footnote">AI imports keep their current usage safeguards. Meal planning and grocery lists are still coming soon. Existing free recipe features remain available.</p></div>
    <div className="premium-action"><span className="sandbox-label"><ShieldCheck size={14}/> Stripe Sandbox · test payments only</span>
      {loading ? <p role="status" className="billing-status">Checking your membership…</p> : demo ? <p className="billing-status"><strong>Demo Premium is included.</strong><br/>Your class demo account already has full Premium access. No payment is needed.</p> : active ? <p className="billing-status" role="status"><strong>Premium is active.</strong><br/>{status?.subscription?.cancelAtPeriodEnd ? 'Cancellation is scheduled. Your membership continues through the paid period.' : 'Your membership is verified through Stripe.'}</p> : success ? <p className="billing-status" role="status"><strong>Checking your membership.</strong><br/>We’ll activate Premium only after Stripe’s signed notification is verified. This return page does not grant access.</p> : <p className="billing-status">{hasPlan ? 'Your subscription needs attention. Manage your billing to check payment details.' : 'Start your monthly Premium membership with secure Stripe Checkout.'}</p>}
      {status?.subscription?.periodEnd && <p className="billing-date">{status.subscription.cancelAtPeriodEnd ? 'Paid period ends' : 'Current period ends'}: {new Date(status.subscription.periodEnd * 1000).toLocaleDateString()}</p>}
      {!loading && !demo && !success && <button className="button button-dark" disabled={busy || (!anonymous && !status)} onClick={() => action(hasPlan ? 'portal' : 'checkout')}>{busy ? <LoaderCircle size={16} className="account-spinner"/> : <CreditCard size={16}/>} {hasPlan ? 'Manage subscription' : 'Subscribe to Premium'}<ArrowUpRight size={16}/></button>}
      {!loading && !demo && success && hasPlan && <button className="recipe-secondary" disabled={busy} onClick={() => action('portal')}>Manage subscription <ArrowUpRight size={14}/></button>}
      {!loading && status && !status.checkoutReady && !demo && !hasPlan && <p className="premium-footnote">Sandbox checkout will be enabled once webhook setup is complete.</p>}
      {error && <p className="account-message account-error" role="alert">{error}</p>}
      <div className="billing-links"><button className="account-inline-button" disabled={loading || busy} onClick={() => { setLoading(true); void load(); }}>Refresh membership</button>{compact && <Link href="/billing">Plan details <ArrowUpRight size={12}/></Link>}</div>
      <p className="premium-footnote">Use Stripe test card details only. No real payment is taken in Sandbox. Premium is separate from administrator privileges.</p>
    </div>
  </section>;
}
