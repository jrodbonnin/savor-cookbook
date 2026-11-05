import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/server';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
export const metadata: Metadata = { title: 'Log in — Savor' };
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; logout?: string }> }) {
  const { data, error } = await getAuth().getSession();
  if (!error && data?.user) redirect('/dashboard');
  const params = await searchParams;
  return <AuthShell>{params.verified && <p className="account-message" role="status">Your email is verified. Log in to continue.</p>}{params.logout && <p className="account-message" role="status">You’re logged out. See you in the kitchen soon.</p>}<AuthForm mode="login"/></AuthShell>;
}
