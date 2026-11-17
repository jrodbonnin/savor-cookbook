import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/server';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { googleAuthEnabled, googleAuthError } from '@/lib/auth/google';
export const metadata: Metadata = { title: 'Create an account — Savor' };
export const dynamic = 'force-dynamic';
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ google?: string; error?: string }> }) {
  const { data, error } = await getAuth().getSession();
  if (!error && data?.user) redirect('/dashboard');
  const params = await searchParams;
  return <AuthShell><AuthForm mode="signup" googleEnabled={googleAuthEnabled(process.env.SAVOR_GOOGLE_AUTH_ENABLED)} googleError={googleAuthError(params.google, params.error)}/></AuthShell>;
}
