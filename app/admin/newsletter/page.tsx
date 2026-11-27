import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminNewsletterClient, type Lectura } from './AdminNewsletterClient';
import type { Newsletter } from '@/lib/types/database';

export const metadata = { title: 'Newsletter' };

export default async function AdminNewsletterPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  const [{ data: articulos }, { data: vistos }, { count: socios }] = await Promise.all([
    supabase.from('newsletter').select('*').order('created_at', { ascending: false }),
    supabase.from('newsletter_vistos').select('newsletter_id, visto_at, socio:profiles(nombre)').order('visto_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('rol', 'socio').eq('estado', 'activo'),
  ]);
  // Quiénes abrieron cada novedad, la más reciente primero
  const lecturas: Record<string, Lectura[]> = {};
  for (const v of (vistos ?? []) as unknown as { newsletter_id: string; visto_at: string; socio: { nombre: string } | null }[]) {
    (lecturas[v.newsletter_id] ??= []).push({ nombre: v.socio?.nombre ?? 'Socio', visto_at: v.visto_at });
  }

  return <AdminNewsletterClient articulos={(articulos as Newsletter[]) ?? []} lecturas={lecturas} sociosActivos={socios ?? 0} />;
}
