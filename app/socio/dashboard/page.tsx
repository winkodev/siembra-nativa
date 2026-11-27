import { redirect } from 'next/navigation';
import { getProfile, createClient } from '@/lib/supabase/server';
import { SocioDashboardClient } from './SocioDashboardClient';
import type { Newsletter } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Inicio' };

export default async function SocioDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();

  // Novedades publicadas y cuáles ya abrió (las notificaciones las carga la campana del header)
  // Vigentes: sin vencimiento o hasta hoy inclusive (fecha argentina). Las fijadas primero.
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const [{ data: novedades }, { data: vistas }] = await Promise.all([
    supabase.from('newsletter').select('*').eq('publicado', true).or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order('fijada', { ascending: false }).order('fecha_publicacion', { ascending: false }).limit(30),
    supabase.from('newsletter_vistos').select('newsletter_id').eq('socio_id', profile.id),
  ]);

  return (
    <SocioDashboardClient
      profile={profile}
      novedades={(novedades ?? []) as Newsletter[]}
      vistas={(vistas ?? []).map(v => v.newsletter_id)}
    />
  );
}
