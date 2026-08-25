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
      costoEnvio={config.costo_envio}
      envioGratisDesde={config.envio_gratis_desde}
    >
      <div className="min-h-screen">
        <FondoClub />
        <Sidebar rol="socio" nombre={profile.nombre} />

        <main className="lg:pl-64">
          {/* Carrito flotante de verdad (fixed): no ocupa lugar en el flujo,
              así el contenido arranca arriba */}
          <div className="fixed top-3 right-4 sm:right-6 lg:right-8 z-30">
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
