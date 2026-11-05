import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { LogoutForm } from '@/components/logout-form';
export const metadata = { title: 'Log out — Savor' };
export default function LogoutPage() {
  return <AuthShell><div className="eyebrow">UNTIL NEXT TIME</div><h2>All done for now?</h2><p className="account-intro">Log out of Savor on this device. Your account will be here when you come back.</p><LogoutForm/><p className="account-switch"><Link href="/dashboard">Stay in my cookbook</Link></p></AuthShell>;
}
