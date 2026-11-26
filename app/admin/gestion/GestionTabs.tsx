'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Submódulos de Gestión: Tareas y Personal (sueldos, aumentos y retiros)
const tabs = [
  { href: '/admin/gestion',          label: 'Tareas',   icon: <ClipboardCheck className="w-4 h-4" /> },
  { href: '/admin/gestion/personal', label: 'Personal', icon: <Users className="w-4 h-4" /> },
];

export function GestionTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1.5 p-1 glass-card rounded-xl w-fit">
      {tabs.map(t => (
        <Link key={t.href} href={t.href}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            pathname === t.href ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground'
          )}>
          {t.icon} {t.label}
        </Link>
      ))}
    </div>
  );
}
