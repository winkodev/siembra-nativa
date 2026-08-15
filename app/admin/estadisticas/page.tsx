import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { EstadisticasClient } from './EstadisticasClient';
import type { EstadisticasClub } from '@/lib/types/database';

export const metadata = { title: 'Estadísticas' };

interface Props {
  searchParams: { desde?: string; hasta?: string; g?: string };
}

const AGRUPACIONES = ['day', 'week', 'month'] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

export default async function EstadisticasPage({ searchParams }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  // Defaults: este mes, agrupado por día
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const desde = searchParams.desde ? new Date(`${searchParams.desde}T00:00:00`) : inicioMes;
  const hasta = searchParams.hasta ? new Date(`${searchParams.hasta}T23:59:59.999`) : ahora;
  const agrupacion: Agrupacion = AGRUPACIONES.includes(searchParams.g as Agrupacion)
    ? (searchParams.g as Agrupacion)
    : 'day';

  const supabase = createClient();
  const { data, error } = await supabase.rpc('estadisticas_club', {
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
    p_agrupacion: agrupacion,
  });

  return (
    <EstadisticasClient
      stats={error ? null : (data as EstadisticasClub)}
      desde={desde.toISOString().slice(0, 10)}
      hasta={hasta.toISOString().slice(0, 10)}
      agrupacion={agrupacion}
      errorMsg={error ? 'No se pudieron cargar las estadísticas. ¿Se ejecutó estadisticas.sql en Supabase?' : null}
    />
  );
}
