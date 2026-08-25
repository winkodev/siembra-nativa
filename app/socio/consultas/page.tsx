import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConsultasClient } from './ConsultasClient';
import type { Consulta } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Consultas' };

export default async function ConsultasPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();
  // RLS: el socio solo ve sus propias consultas
  const { data: consultas } = await supabase
    .from('consultas')
    .select('*')
    .order('created_at', { ascending: false });

  return <ConsultasClient consultas={(consultas ?? []) as Consulta[]} />;
}
