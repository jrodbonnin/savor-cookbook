import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Savor — From saved to served', description: 'Turn your favorite recipe videos into a personal cookbook, thoughtful meal plans, and ready-to-go grocery lists. A college project concept.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
