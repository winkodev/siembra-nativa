import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AnunciosClient, type AnuncioVista } from './AnunciosClient';
import type { Anuncio } from '@/lib/types/database';

export const metadata = { title: 'Anuncios' };

// Anuncios para los socios (popup al entrar + campana). Cualquier admin.
export default async function AnunciosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  const [{ data: anuncios, error }, { data: vistos }] = await Promise.all([
    supabase.from('anuncios').select('*').order('created_at', { ascending: false }),
    supabase.from('anuncios_vistos').select('anuncio_id'),
  ]);

  // Cuántos socios ya tocaron "Entendido" en cada anuncio
  const conteo: Record<string, number> = {};
  for (const v of (vistos ?? []) as { anuncio_id: string }[]) conteo[v.anuncio_id] = (conteo[v.anuncio_id] ?? 0) + 1;

  const lista: AnuncioVista[] = ((anuncios ?? []) as Anuncio[]).map(a => ({ ...a, vistos: conteo[a.id] ?? 0 }));

  return (
    <AnunciosClient
      anuncios={lista}
      errorMsg={error ? 'No se pudieron cargar los anuncios. ¿Se ejecutó anuncios.sql en Supabase?' : null}
    />
  );
}
