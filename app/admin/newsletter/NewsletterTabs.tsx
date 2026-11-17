'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Newspaper, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Comunicación con los socios: artículos del newsletter y anuncios (popup)
const tabs = [
  { href: '/admin/newsletter',          label: 'Artículos', icon: <Newspaper className="w-4 h-4" /> },
  { href: '/admin/newsletter/anuncios', label: 'Anuncios',  icon: <Megaphone className="w-4 h-4" /> },
];

export function NewsletterTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1.5 p-1 glass-card rounded-xl w-fit">
      {tabs.map(t => {
        const activo = t.href === '/admin/newsletter' ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={cn('flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activo ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground')}>
            {t.icon} {t.label}
          </Link>
        );
      })}
    </div>
  );
}
