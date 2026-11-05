import Link from 'next/link';
import { Utensils } from 'lucide-react';
export function Brand() {
  return <Link className="logo" href="/" aria-label="Savor home"><span className="logo-mark"><Utensils size={21} strokeWidth={1.8}/></span>savor<span className="logo-dot">.</span></Link>;
}
