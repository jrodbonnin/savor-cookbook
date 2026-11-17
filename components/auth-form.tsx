'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { googleSignInOptions } from '@/lib/auth/google';

export function AuthForm({ mode, googleEnabled, googleError }: {
  mode: 'signup' | 'login';
  googleEnabled: boolean;
  googleError: string;
}) {
  const signup = mode === 'signup';
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState(googleError);
  const [notice, setNotice] = useState('');
  const [verify, setVerify] = useState(false);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    function resetGoogleLoading(event: PageTransitionEvent) {
      if (event.persisted) setGoogleBusy(false);
    }
    window.addEventListener('pageshow', resetGoogleLoading);
    return () => window.removeEventListener('pageshow', resetGoogleLoading);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || googleBusy) return;
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

  async function continueWithGoogle() {
    if (busy || googleBusy || !googleEnabled) return;
    setGoogleBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await authClient.signIn.social(googleSignInOptions(mode));
      // The SDK supports Neon's shared-key redirect as well as Google directly.
      if (!result.error && result.data?.redirect && result.data.url) {
        return;
      }
    } catch {
      // Provider details can contain sensitive information. Show a fixed message.
    }
    setError('Google sign-in could not start. Please try again or use your password.');
    setGoogleBusy(false);
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
    {!verify && <>
      <button type="button" className="button account-google" onClick={continueWithGoogle}
        disabled={!googleEnabled || busy || googleBusy} aria-busy={googleBusy}
        aria-describedby={googleEnabled ? undefined : 'google-unavailable'}>
        {googleBusy ? <LoaderCircle size={17} className="account-spinner" aria-hidden="true"/> :
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.67-.34-3.94H24v7.45h11.03a9.43 9.43 0 0 1-4.09 6.19v5.14h6.62c3.87-3.57 6.05-8.83 6.05-14.84z"/>
            <path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.7l-6.62-5.14c-1.83 1.22-4.17 1.95-6.89 1.95-5.32 0-9.83-3.59-11.45-8.42H5.72v5.3A20 20 0 0 0 24 44z"/>
            <path fill="#FBBC05" d="M12.55 27.69a12 12 0 0 1 0-7.38v-5.3H5.72a20 20 0 0 0 0 17.98z"/>
            <path fill="#EA4335" d="M24 11.89c3 0 5.68 1.03 7.81 3.06l5.85-5.86C34.13 5.81 29.51 4 24 4A20 20 0 0 0 5.72 15.01l6.83 5.3C14.17 15.48 18.68 11.89 24 11.89z"/>
          </svg>}
        {googleBusy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {!googleEnabled && <p id="google-unavailable" className="account-google-note">Google sign-in is currently unavailable.</p>}
      <div className="account-divider">or use your email</div>
    </>}
    <form className="account-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || googleBusy}>
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
