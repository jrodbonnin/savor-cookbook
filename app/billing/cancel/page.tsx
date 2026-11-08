import Link from 'next/link';
import { Brand } from '@/components/brand';
export const metadata = { title: 'Checkout canceled — Savor', robots: { index: false } };
export default function CancelPage() {
  return <div className="account-page"><header className="container account-header"><Brand/><Link className="account-back" href="/dashboard">Back to my cookbook</Link></header><main className="container billing-main"><section className="billing-cancel"><div className="eyebrow">NO RUSH. THE KITCHEN’S STILL OPEN.</div><h1>Maybe <em>next time.</em></h1><p>You returned from Checkout. This page does not change your subscription or Premium access. Your recipes are still in your cookbook.</p><Link className="button button-dark" href="/billing">Return to membership</Link><Link className="recipe-secondary" href="/dashboard">Open my cookbook</Link></section></main></div>;
}
