import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { DetalleGeneticaClient } from './DetalleGeneticaClient';
import { getAppConfig } from '@/lib/supabase/config';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase.from('geneticas').select('nombre').eq('id', params.id).single();
  return { title: data?.nombre ?? 'Genética' };
}

export default async function DetalleGeneticaPage({ params }: Props) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();
  const [{ data: genetica }, config] = await Promise.all([
    supabase.from('stock_publico').select('*').eq('genetica_id', params.id).single(),
    getAppConfig(),
  ]);

  if (!genetica) notFound();
  if (genetica.stock_total_gramos < config.stock_minimo_visible) notFound();

  return (
    <DetalleGeneticaClient
      genetica={genetica}
      puedeHacerPedidos={profile.compra_habilitada}
    />
  );
}
