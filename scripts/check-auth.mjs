// Creates a temporary, randomly named test user in Neon Auth, exercises sessions,
// without deleting any users. Run only with explicit approval to create test data. No credentials or cookies are printed or saved.
import { randomBytes } from 'node:crypto';
if (process.env.AUTH_TEST_CREATE_USER !== 'yes') {
  console.error('This check creates a real Neon test user. Set AUTH_TEST_CREATE_USER=yes only after approving test data creation. No users are deleted.');
  process.exit(2);
}
const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3000';
const email = `savor-check-${randomBytes(8).toString('hex')}@example.com`;
const password = `${randomBytes(24).toString('base64url')}aA9!`;
const cookies = new Map();
async function request(path, body, authenticated = true) {
  const res = await fetch(`${origin}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'manual',
    headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated && cookies.size ? { Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (authenticated) for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';'); const i = pair.indexOf('=');
    if (i > 0) { if (/max-age=0(?:;|$)/i.test(c)) cookies.delete(pair.slice(0,i)); else cookies.set(pair.slice(0,i),pair.slice(i+1)); }
  }
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { res, data, text };
}
function assert(test, label) { if (!test) throw new Error(label); console.log(`PASS ${label}`); }
let registered = false;
try {
  const out = await request('/dashboard', undefined, false);
  assert(out.res.status === 307 && out.res.headers.get('location')?.includes('/login'), 'signed-out dashboard is protected');
  const signup = await request('/api/auth/sign-up/email', { name: 'Savor integration check', email, password });
  if (!signup.res.ok) {
    console.log('Signup HTTP status:', signup.res.status);
    console.log('Signup error code:', signup.data?.code || 'not supplied');
    throw new Error('Neon did not accept the test signup');
  }
  registered = true;
  assert(!!signup.data?.user, 'email/password signup reaches Neon');
  const session = await request('/api/auth/get-session?disableCookieCache=true');
  if (!session.data?.user) {
    console.log('MANUAL CHECK REQUIRED: Neon requires email verification. Use an email address you own in the signup form.');
    process.exitCode = 2;
  } else {
    assert(session.data.user.email === email, 'signup creates a server session');
    const cookieHeaders = signup.res.headers.getSetCookie();
    assert(cookieHeaders.some(c => /httponly/i.test(c)), 'session uses HttpOnly cookies');
    assert(cookieHeaders.some(c => /(?:max-age|expires)=/i.test(c)), 'session cookies persist between browser visits');
    const dashboard = await request('/dashboard');
    assert(dashboard.res.status === 200 && dashboard.text.includes('Your story is still cooking.'), 'authenticated cookbook renders');
    await request('/api/auth/sign-out', {});
    assert(!(await request('/api/auth/get-session?disableCookieCache=true')).data?.user, 'logout clears the session');
    const wrong = await request('/api/auth/sign-in/email', { email, password: randomBytes(20).toString('hex'), rememberMe: true });
    assert(!wrong.res.ok, 'incorrect password is rejected');
    const login = await request('/api/auth/sign-in/email', { email, password, rememberMe: true });
    assert(login.res.ok, 'existing user can log back in');
    assert((await request('/api/auth/get-session?disableCookieCache=true')).data?.user?.email === email, 'login restores the saved user session');
    const staleCookies = new Map(cookies);
    await request('/api/auth/sign-out', {});
    cookies.clear(); for (const [k,v] of staleCookies) cookies.set(k,v);
    assert(!(await request('/api/auth/get-session?disableCookieCache=true')).data?.user, 'revoked session cannot be reused');
    cookies.clear();
    await request('/api/auth/sign-in/email', { email, password, rememberMe: true });
  }
} catch (error) {
  console.error('FAIL', error instanceof Error ? error.message : 'Authentication check failed');
  process.exitCode = 1;
} finally {
  if (registered) {
    await request('/api/auth/sign-out', {});
    console.log('NOTE test user retained; no database users were deleted.');
  }
}
