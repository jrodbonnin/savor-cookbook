import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Leaf, CalendarDays, ShoppingBasket, LogOut, ArrowUpRight } from 'lucide-react';
import { getAuth } from '@/lib/auth/server';
import { Brand } from '@/components/brand';
import { SessionCheck } from '@/components/session-check';
import { Cookbook } from '@/components/cookbook';
import { BillingPanel } from '@/components/billing-panel';
export const metadata: Metadata = { title: 'My cookbook — Savor', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const { data, error } = await getAuth().getSession({ query: { disableCookieCache: true } });
  if (error) throw new Error('Your session could not be checked. Please try again.');
  if (!data?.user) redirect('/login');
  const user = data.user;
  const firstName = user.name?.trim().split(/\s+/)[0] || 'chef';
  return <div className="account-page"><SessionCheck/><header className="container account-header"><Brand/><div className="dashboard-account"><span className="dashboard-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</span><Link className="account-back" href="/logout">Log out <LogOut size={15}/></Link></div></header><main className="container dashboard-main" id="main"><div className="eyebrow"><Leaf size={14}/> YOUR LITTLE CORNER OF SAVOR</div><h1>Welcome to the kitchen,<br/><em>{firstName}.</em></h1><p className="dashboard-intro">A little inspiration. A little organization. Something delicious ahead.</p><div className="dashboard-tabs"><span><BookOpen size={16}/> My cookbook</span><span className="dashboard-soon">Meal planning · Coming soon</span></div><Cookbook/><BillingPanel compact/><div className="dashboard-grid"><article><CalendarDays size={23}/><div><h3>A week worth looking forward to.</h3><p>Meal planning is next on the menu.</p></div></article><article><ShoppingBasket size={23}/><div><h3>A little less to remember.</h3><p>Automatic grocery lists are coming later.</p></div></article></div><div className="dashboard-details"><span>Signed in as <strong>{user.email}</strong></span><Link href="/">Explore Savor <ArrowUpRight size={14}/></Link></div></main><footer className="container account-footer">Created by José Andrés Rodríguez Bonnin <span>A little order. A lot of flavor.</span></footer></div>;
}
