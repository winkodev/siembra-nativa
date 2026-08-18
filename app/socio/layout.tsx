import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/server';
import { getAppConfig } from '@/lib/supabase/config';
import { Sidebar } from '@/components/layout/Sidebar';
import { FondoClub } from '@/components/layout/FondoClub';
import { PageTransition } from '@/components/layout/PageTransition';
import { CarritoProvider } from '@/lib/context/CarritoContext';
import { CarritoDrawer } from '@/components/layout/CarritoDrawer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s | Siembra Nativa Club', default: 'Socio' },
};

export default async function SocioLayout({ children }: { children: React.ReactNode }) {
  const [profile, config] = await Promise.all([getProfile(), getAppConfig()]);

  if (!profile) redirect('/login');
  if (profile.rol === 'admin') redirect('/admin/dashboard');
  if (profile.estado === 'inactivo') redirect('/inactivo');

  return (
    <CarritoProvider
      maxGramos={config.max_gramos_pedido}
      descuento20={config.descuento_20}
      descuento40={config.descuento_40}
    >
      <div className="min-h-screen">
        <FondoClub />
        <Sidebar rol="socio" nombre={profile.nombre} />

        <main className="lg:pl-64">
          {/* Carrito flotante (sin franja: no rompe la inmersión del fondo) */}
          <div className="sticky top-0 z-30 flex justify-end px-4 sm:px-6 lg:px-8 py-3 pointer-events-none [&>*]:pointer-events-auto">
            <CarritoDrawer />
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </CarritoProvider>
  );
}
