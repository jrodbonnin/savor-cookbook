import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/server';
import { Brand } from '@/components/brand';
import { BillingPanel } from '@/components/billing-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checking your membership — Savor', robots: { index: false } };
export default async function SuccessPage() {
  const { data } = await getAuth().getSession();
  if (!data?.user) redirect('/login');
  return <div className="account-page"><header className="container account-header"><Brand/><Link className="account-back" href="/dashboard">Back to my cookbook</Link></header><main className="container billing-main"><div className="billing-page-heading"><div className="eyebrow">WELCOME BACK TO SAVOR</div><h1>A little more <em>possibility.</em></h1><p>Your membership status below comes from verified Stripe notifications. It may take a moment to update.</p></div><BillingPanel success/></main></div>;
}
