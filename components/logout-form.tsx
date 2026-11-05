'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
export function LogoutForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) { setError('We couldn’t log you out. Please try again.'); return; }
      window.location.replace('/login?logout=1');
    } catch { setError('Savor could not reach the sign-in service. Please try again.'); }
    finally { setBusy(false); }
  }
  return <><button type="button" className="button button-dark account-submit" disabled={busy} onClick={logout}>{busy ? 'Logging out…' : 'Log out'}<LogOut size={16}/></button>{error && <p className="account-message account-error" role="alert">{error}</p>}</>;
}
