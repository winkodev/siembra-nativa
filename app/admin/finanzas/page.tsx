import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FinanzasClient } from './FinanzasClient';
import type { FinanzasClub } from '@/lib/types/database';

export const metadata = { title: 'Finanzas' };

interface Props {
  searchParams: { desde?: string; hasta?: string; estados?: string; g?: string };
}

const AGRUPACIONES = ['day', 'week', 'month'] as const;
export type AgrupacionFin = (typeof AGRUPACIONES)[number];

// Qué pedidos se cuentan: por defecto los que ya tienen el pago chequeado
const PRESETS_ESTADOS: Record<string, string[]> = {
  cobrados:   ['aprobado', 'entregado'],
  entregados: ['entregado'],
  todos:      ['pendiente', 'aprobado', 'entregado'],
};
export type FiltroEstados = keyof typeof PRESETS_ESTADOS;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Finanzas: solo el superadmin. Los demás admins van al dashboard.
export default async function FinanzasPage({ searchParams }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  // Default: este mes, agrupado por día, pedidos cobrados
  const ahora     = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const desde = searchParams.desde ? new Date(`${searchParams.desde}T00:00:00`) : inicioMes;
  const hasta = searchParams.hasta ? new Date(`${searchParams.hasta}T23:59:59.999`) : ahora;
  const agrupacion: AgrupacionFin = AGRUPACIONES.includes(searchParams.g as AgrupacionFin) ? (searchParams.g as AgrupacionFin) : 'day';
  const filtroEstados: FiltroEstados = (searchParams.estados && searchParams.estados in PRESETS_ESTADOS) ? searchParams.estados : 'cobrados';

  const supabase = createClient();
  const { data, error } = await supabase.rpc('finanzas_club', {
    p_desde:      desde.toISOString(),
    p_hasta:      hasta.toISOString(),
    p_estados:    PRESETS_ESTADOS[filtroEstados],
    p_agrupacion: agrupacion,
  });

  return (
    <FinanzasClient
      datos={error ? null : (data as FinanzasClub)}
      desde={iso(desde)}
      hasta={iso(hasta)}
      agrupacion={agrupacion}
      filtroEstados={filtroEstados}
      errorMsg={error ? 'No se pudieron cargar las finanzas. ¿Se ejecutó finanzas.sql en Supabase?' : null}
    />
  );
}
