'use client';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/client';
// Recheck when returning to a cached tab or after signing out in another tab.
export function SessionCheck() {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    async function check() {
      if (document.visibilityState === 'hidden') return;
      try {
        const { data, error } = await authClient.getSession({ query: { disableCookieCache: true } });
        if (!active) return;
        if (error) { setUnavailable(true); return; }
        setUnavailable(false);
        if (!data?.user) window.location.replace('/login');
      } catch { if (active) setUnavailable(true); }
    }
    void check();
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('pageshow', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('pageshow', check); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, []);
  return unavailable ? <p className="account-message" role="status">We can’t confirm your connection right now. Savor will try again when you return to this tab.</p> : null;
}
