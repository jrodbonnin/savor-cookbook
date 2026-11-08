import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/server';
import { Brand } from '@/components/brand';
import { BillingPanel } from '@/components/billing-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Savor Premium — Membership', robots: { index: false } };
export default async function BillingPage() {
  const { data } = await getAuth().getSession();
  if (!data?.user) redirect('/login');
  return <div className="account-page"><header className="container account-header"><Brand/><Link className="account-back" href="/dashboard">Back to my cookbook</Link></header><main className="container billing-main"><BillingPanel/></main><footer className="container account-footer">Savor · Stripe Sandbox <span>Created by José Andrés Rodríguez Bonnin</span></footer></div>;
}
