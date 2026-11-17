export const GOOGLE_CALLBACK_PATH = '/auth/callback/google';
export const GOOGLE_ERROR_PATH = '/login?google=failed';

export function googleAuthEnabled(value: string | undefined) {
  return value === 'true';
}

export function googleAuthError(google: unknown, error: unknown) {
  if (google !== 'failed') return '';
  if (error === 'access_denied') return 'Google sign-in was canceled. You can try again or use your password.';
  if (error === 'account_not_linked' || error === 'account not linked') {
    return 'This Google email matches an existing Savor account. Please log in with your password. Connecting Google to an existing account is temporarily unavailable.';
  }
  return 'Google sign-in could not be completed. Please try again or use your password.';
}

export function googleSignInOptions(mode: 'login' | 'signup') {
  return {
    provider: 'google' as const,
    callbackURL: GOOGLE_CALLBACK_PATH,
    errorCallbackURL: `/${mode}?google=failed`,
  };
}

export function isGoogleSignInRequest(body: unknown) {
  if (!body || typeof body !== 'object') return false;
  const allowedKeys = Object.keys(googleSignInOptions('login'));
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) return false;
  const { provider, callbackURL, errorCallbackURL } =
    body as Partial<ReturnType<typeof googleSignInOptions>>;
  return provider === 'google' && callbackURL === GOOGLE_CALLBACK_PATH &&
    (errorCallbackURL === GOOGLE_ERROR_PATH || errorCallbackURL === '/signup?google=failed');
}
