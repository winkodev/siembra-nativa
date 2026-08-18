import { redirect } from 'next/navigation';
import { getProfile, createClient } from '@/lib/supabase/server';
import { SocioDashboardClient } from './SocioDashboardClient';
import type { Newsletter, Notificacion } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function SocioDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();

  // Último newsletter publicado + notificaciones del socio (RLS: solo propias)
  const [{ data: newsletter }, { data: notificaciones }] = await Promise.all([
    supabase
      .from('newsletter')
      .select('*')
      .eq('publicado', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <SocioDashboardClient
      profile={profile}
      newsletter={newsletter as Newsletter | null}
      notificaciones={(notificaciones as Notificacion[]) ?? []}
    />
  );
}
