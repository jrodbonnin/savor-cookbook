'use client';
import Link from 'next/link';
export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="container dashboard-main"><h1>Let’s try that again.</h1><p>Savor couldn’t confirm your session. Check your connection, then retry.</p><button className="button button-dark" onClick={reset}>Try again</button><p><Link href="/login">Return to login</Link></p></main>;
}
