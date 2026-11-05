import Link from 'next/link';
import { Leaf, ArrowLeft, BookOpen } from 'lucide-react';
import { Brand } from './brand';
export function AuthShell({ children }: { children: React.ReactNode }) {
  return <div className="account-page"><header className="container account-header"><Brand/><Link className="account-back" href="/"><ArrowLeft size={15}/> Back to Savor</Link></header><main className="container account-layout" id="main"><section className="account-story"><div className="eyebrow"><Leaf size={14}/> A LITTLE ORDER. A LOT OF FLAVOR.</div><h1>Your next chapter<br/>starts in the <em>kitchen.</em></h1><p>A home for your food inspiration.<br/>And a little room for something delicious.</p><div className="account-illustration"><BookOpen size={66} strokeWidth={1}/><span>Good food. Good company.</span><Leaf size={24}/></div></section><section className="account-panel">{children}</section></main><footer className="container account-footer">Created by José Andrés Rodríguez Bonnin <span>Savor · Your everyday cooking companion</span></footer></div>;
}
