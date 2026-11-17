import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOOGLE_CALLBACK_PATH,
  googleAuthEnabled,
  googleAuthError,
  googleSignInOptions,
  isGoogleSignInRequest,
} from '../lib/auth/google.ts';

test('Google sign-in requires explicit opt-in', () => {
  for (const value of [undefined, '', '1', 'TRUE', 'false']) {
    assert.equal(googleAuthEnabled(value), false);
  }
  assert.equal(googleAuthEnabled('true'), true);
});

test('both forms use the same session callback and return errors to their own page', () => {
  for (const mode of ['login', 'signup']) {
    const options = googleSignInOptions(mode);
    assert.equal(options.callbackURL, GOOGLE_CALLBACK_PATH);
    assert.equal(options.errorCallbackURL, `/${mode}?google=failed`);
    assert.equal('disableRedirect' in options, false);
    assert.ok(isGoogleSignInRequest(options));
  }
});

test('the app proxy only accepts the Google authorization-code flow with fixed callbacks', () => {
  const options = googleSignInOptions('login');
  for (const body of [
    null,
    [],
    { ...options, provider: 'github' },
    { ...options, callbackURL: 'https://other.example' },
    { ...options, errorCallbackURL: '//other.example' },
    { ...options, newUserCallbackURL: '//other.example' },
    { ...options, idToken: { token: 'untrusted' } },
    { ...options, disableRedirect: true },
    { ...options, additionalParams: { prompt: 'none' } },
    { ...options, additionalParams: { prompt: 'select_account', redirect_uri: 'https://other.example' } },
  ]) {
    assert.equal(isGoogleSignInRequest(body), false);
  }
});

test('OAuth errors display fixed copy without reflecting provider data', () => {
  assert.equal(googleAuthError(undefined, 'access_denied'), '');
  assert.match(googleAuthError('failed', 'access_denied'), /canceled/);
  assert.match(googleAuthError('failed', 'account_not_linked'), /existing Savor account/);
  assert.match(googleAuthError('failed', 'account_not_linked'), /temporarily unavailable/);
  assert.doesNotMatch(googleAuthError('failed', 'account_not_linked'), /select Connect Google/);
  assert.doesNotMatch(googleAuthError('failed', 'private provider detail'), /private provider detail/);
});

