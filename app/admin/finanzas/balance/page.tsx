import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalanceClient, type MovBalance } from './BalanceClient';

export const metadata = { title: 'Balance' };

interface Props {
  searchParams: { desde?: string; hasta?: string };
}

const fechaOk = (f?: string) => Boolean(f && /^\d{4}-\d{2}-\d{2}$/.test(f));
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Balance: cuánto entró y salió en un período, según los movimientos de Tesorería.
// Transferencias, cambios de moneda y saldos iniciales no cuentan: la plata sigue en el club.
export default async function BalancePage({ searchParams }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  // Default: este año
  const ahora = new Date();
  const desde = fechaOk(searchParams.desde) ? searchParams.desde! : iso(new Date(ahora.getFullYear(), 0, 1));
  const hasta = fechaOk(searchParams.hasta) ? searchParams.hasta! : iso(ahora);

  const { data, error } = await createClient()
    .from('tes_movimientos')
    .select('id, fecha, tipo, moneda, monto, concepto, categoria:tes_categorias(nombre)')
    .in('tipo', ['ingreso', 'egreso'])
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .limit(10000);

  const movimientos: MovBalance[] = ((data ?? []) as unknown as {
    id: string; fecha: string; tipo: 'ingreso' | 'egreso'; moneda: 'ARS' | 'USD'; monto: number; concepto: string; categoria: { nombre: string } | null;
  }[]).map(m => ({
    id: m.id, fecha: m.fecha, tipo: m.tipo, moneda: m.moneda, monto: Number(m.monto), concepto: m.concepto,
    categoria: m.categoria?.nombre ?? 'Sin categoría',
  }));

  return (
    <BalanceClient movimientos={movimientos} desde={desde} hasta={hasta}
      errorMsg={error ? 'No se pudo cargar el balance. ¿Se ejecutó tesoreria.sql en Supabase?' : null} />
  );
}
