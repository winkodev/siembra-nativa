'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import {
  LayoutDashboard, ShoppingBag, User, Newspaper,
  Users, Package, ClipboardList, LogOut, Menu, X, Shield, Settings, BarChart3,
  HelpCircle,
} from 'lucide-react';
import { useState } from 'react';
import { logout } from '@/app/actions/auth';

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

const navSocio: NavItem[] = [
  { href: '/socio/dashboard', label: 'Inicio',      icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: '/socio/tienda',    label: 'Catálogo',     icon: <ShoppingBag className="w-5 h-5" /> },
  { href: '/socio/pedidos',   label: 'Mis Pedidos',  icon: <ClipboardList className="w-5 h-5" /> },
  { href: '/socio/consultas', label: 'Consultas',    icon: <HelpCircle className="w-5 h-5" /> },
  { href: '/socio/perfil',    label: 'Mi Perfil',    icon: <User className="w-5 h-5" /> },
];

const navAdmin: NavItem[] = [
  { href: '/admin/dashboard',   label: 'Dashboard',    icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: '/admin/socios',      label: 'Socios',       icon: <Users className="w-5 h-5" /> },
  { href: '/admin/inventario',  label: 'Inventario',   icon: <Package className="w-5 h-5" /> },
  { href: '/admin/pedidos',     label: 'Pedidos',      icon: <ClipboardList className="w-5 h-5" /> },
  { href: '/admin/consultas',   label: 'Consultas',    icon: <HelpCircle className="w-5 h-5" /> },
  { href: '/admin/productos',      label: 'Productos',      icon: <ShoppingBag className="w-5 h-5" /> },
  { href: '/admin/estadisticas',   label: 'Estadísticas',   icon: <BarChart3 className="w-5 h-5" /> },
  { href: '/admin/newsletter',     label: 'Newsletter',     icon: <Newspaper className="w-5 h-5" /> },
  { href: '/admin/configuracion',  label: 'Configuración',  icon: <Settings className="w-5 h-5" /> },
];

interface SidebarProps {
  rol: 'socio' | 'admin';
  nombre: string;
}

export function Sidebar({ rol, nombre }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = rol === 'admin' ? navAdmin : navSocio;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Marca — solo el logotipo, centrado */}
      <div className="px-6 pt-7 pb-6 flex justify-center border-b border-club-verde-claro/20">
        <Logo variant="text" size="md" href={rol === 'admin' ? '/admin/dashboard' : '/socio/dashboard'} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const activo = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                activo
                  ? 'bg-club-dorado/10 text-club-dorado'
                  : 'text-muted-foreground hover:bg-club-verde-claro/25 hover:text-foreground'
              )}
            >
              {/* Barra indicadora del item activo */}
              {activo && (
                <motion.span
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-club-dorado"
                />
              )}
              <span className={cn(
                'transition-colors duration-200',
                activo ? 'text-club-dorado' : 'group-hover:text-club-dorado/70'
              )}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: usuario + logout */}
      <div className="px-3 py-4 border-t border-club-verde-claro/30 space-y-1">
        {/* Badge de rol */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-club-verde-claro/20">
          <div className="w-8 h-8 rounded-full bg-club-dorado/20 border border-club-dorado/30 flex items-center justify-center text-club-dorado text-xs font-bold">
            {nombre[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-xs font-semibold truncate">{nombre}</p>
            <p className="text-muted-foreground text-[11px] capitalize flex items-center gap-1">
              {rol === 'admin' && <Shield className="w-3 h-3" />}
              {rol}
            </p>
          </div>
        </div>

        {/* Logout */}
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </form>
      </div>

    </div>
  );

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-club-verde/95 backdrop-blur-md border-r border-club-verde-claro/30 z-40">
        <SidebarContent />
      </aside>

      {/* Botón hamburguesa mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl glass-card text-foreground hover:text-club-dorado transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar mobile (drawer) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 backdrop-club"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 bg-club-verde border-r border-club-verde-claro/30"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
