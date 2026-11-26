'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardCheck, Landmark, Target, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pestañas de Gestión y finanzas: Dispensa (pedidos), Tesorería (plata del club),
// Objetivos (cuánto hay que juntar), Tareas y Personal (sueldos, aumentos y retiros)
const tabs = [
  { href: '/admin/finanzas',           label: 'Dispensa',  icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/finanzas/tesoreria', label: 'Tesorería', icon: <Landmark className="w-4 h-4" /> },
  { href: '/admin/finanzas/objetivos', label: 'Objetivos', icon: <Target className="w-4 h-4" /> },
  { href: '/admin/gestion',            label: 'Tareas',    icon: <ClipboardCheck className="w-4 h-4" /> },
  { href: '/admin/gestion/personal',   label: 'Personal',  icon: <Users className="w-4 h-4" /> },
];

export function FinanzasTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1.5 p-1 glass-card rounded-xl w-fit max-w-full">
      {tabs.map(t => {
        // Las pestañas raíz solo se marcan en su propia ruta
        const activo = t.href === '/admin/finanzas' || t.href === '/admin/gestion' ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activo ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {t.icon} {t.label}
          </Link>
        );
      })}
    </div>
  );
}
