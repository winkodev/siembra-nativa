import { redirect } from 'next/navigation';
import { getProfile, createClient } from '@/lib/supabase/server';
import { SocioDashboardClient } from './SocioDashboardClient';
import type { Newsletter } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function SocioDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();

  // Último newsletter publicado
  const { data: newsletter } = await supabase
    .from('newsletter')
    .select('*')
    .eq('publicado', true)
    .order('fecha_publicacion', { ascending: false })
    .limit(1)
    .single();

  return (
    <SocioDashboardClient
      profile={profile}
      newsletter={newsletter as Newsletter | null}
    />
  );
}
