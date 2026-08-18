import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { FondoClub } from '@/components/layout/FondoClub';
import { PageTransition } from '@/components/layout/PageTransition';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s | Admin · Siembra Nativa', default: 'Admin' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) redirect('/login');
  if (profile.rol !== 'admin') redirect('/socio/dashboard');

  return (
    <div className="min-h-screen">
      <FondoClub />
      <Sidebar rol="admin" nombre={profile.nombre} />

      <main className="lg:pl-64">
        {/* Header admin con indicador de rol */}
        <div className="sticky top-0 z-30 lg:hidden px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-club-verde-claro/30" />

        <div className="px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6 max-w-7xl mx-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
