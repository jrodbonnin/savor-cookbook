import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/server';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
export const metadata: Metadata = { title: 'Create an account — Savor' };
export const dynamic = 'force-dynamic';
export default async function SignupPage() {
  const { data, error } = await getAuth().getSession();
  if (!error && data?.user) redirect('/dashboard');
  return <AuthShell><AuthForm mode="signup"/></AuthShell>;
}
