'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/lib/auth/client';

export function AuthForm({ mode }: { mode: 'signup' | 'login' }) {
  const signup = mode === 'signup';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verify, setVerify] = useState(false);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      if (verify) {
        const result = await authClient.emailOtp.verifyEmail({ email, otp: String(form.get('code')).trim() });
        if (result.error) { setError('That code could not be verified. Check it or request a new code.'); return; }
        const session = await authClient.getSession({ query: { disableCookieCache: true } });
        if (session.data?.user) { window.location.replace('/dashboard'); return; }
        setVerify(false); setNotice('Email verified. You can now log in with your password.');
        if (signup) window.location.replace('/login?verified=1');
        return;
      }
      const password = String(form.get('password') || '');
      if (signup && password !== form.get('confirmPassword')) { setError('Your passwords do not match.'); return; }
      const normalizedEmail = String(form.get('email') || '').trim();
      setEmail(normalizedEmail);
      const result = signup
        ? await authClient.signUp.email({ name: String(form.get('name') || '').trim(), email: normalizedEmail, password, callbackURL: '/dashboard' })
        : await authClient.signIn.email({ email: normalizedEmail, password, rememberMe: true, callbackURL: '/dashboard' });
      if (result.error) {
        if (result.error.code === 'EMAIL_NOT_VERIFIED') {
          setVerify(true); setNotice('Verify your email to continue. Enter your emailed code, or request a new one below.');
        } else if (result.error.status === 429) {
          setError('Too many attempts. Please wait a little and try again.');
        } else {
          setError(signup ? 'We could not create your account. Check your details, or log in if you already have an account.' : 'We could not log you in. Check your email and password and try again.');
        }
        return;
      }
      const session = await authClient.getSession({ query: { disableCookieCache: true } });
      if (session.data?.user) { window.location.replace('/dashboard'); return; }
      if (signup) { setVerify(true); setNotice('Your account is created. Check your inbox for a verification code or link before continuing.'); }
      else setError('Your session could not be confirmed. Please try logging in again.');
    } catch {
      setError('Savor could not reach the sign-in service. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      if (result.error) setError('We could not send a code. Wait a moment and try again.');
      else setNotice('A new verification code has been requested. Check your inbox and spam folder.');
    } catch { setError('We could not reach the email service. Please try again.'); }
    finally { setBusy(false); }
  }

  return <><div className="eyebrow">{verify ? 'ONE LAST INGREDIENT' : signup ? 'MAKE YOURSELF AT HOME' : 'A FAMILIAR PLACE'}</div><h2>{verify ? 'Check your inbox.' : signup ? 'Your cookbook starts here.' : 'Welcome back.'}</h2><p className="account-intro">{verify ? `Confirm your email address to finish setting up your account.` : signup ? 'Create an account for your own little corner of Savor.' : 'Log in and settle into your personal cookbook.'}</p>
    <form className="account-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        {verify ? <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={12} placeholder="Enter your email code"/></label> : <>
          {signup && <label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="How should we greet you?"/></label>}
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label>
          <label>Password<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : 1} maxLength={128} required placeholder={signup ? 'At least 8 characters' : 'Your password'}/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {signup && <label>Confirm password<input name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required placeholder="One more time"/></label>}
        </>}
        {error && <p className="account-message account-error" role="alert">{error}</p>}
        {notice && <p className="account-message" role="status">{notice}</p>}
        <button className="button button-dark account-submit" type="submit">{busy ? <><LoaderCircle size={17} className="account-spinner"/> Please wait…</> : <>{verify ? 'Verify email' : signup ? 'Create my account' : 'Log in'}<ArrowUpRight size={17}/></>}</button>
      </fieldset>
    </form>
    {verify ? <div className="verification-actions"><button className="account-inline-button" onClick={resend} disabled={busy}>Send a new code</button><Link href="/login">Return to login</Link></div> : <p className="account-switch">{signup ? 'Already have an account?' : 'New to Savor?'} <Link href={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'} <ArrowUpRight size={12}/></Link></p>}
    <p className="account-footnote">{signup ? 'Your recipes have a home in the making. Accounts are ready; recipe tools are coming next.' : 'You’ll stay signed in on this device until your session expires or you log out.'}</p>
  </>;
}
