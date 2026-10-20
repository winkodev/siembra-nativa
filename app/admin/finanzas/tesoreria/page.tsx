import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAppConfig } from '@/lib/supabase/config';
import { TesoreriaClient, type MovimientoVista, type DeudaVista } from './TesoreriaClient';
import type { TesCuenta, TesCategoria, TesSaldo, TesDeuda, TesMovimiento } from '@/lib/types/database';

export const metadata = { title: 'Tesorería' };

interface Props {
  searchParams: { desde?: string; hasta?: string };
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Tesorería: solo el superadmin. Carga cuentas, saldos, deudas con su saldo,
// categorías y los movimientos del período (default: últimos 90 días).
export default async function TesoreriaPage({ searchParams }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  const ahora  = new Date();
  const hace90 = new Date(ahora); hace90.setDate(ahora.getDate() - 90);
  const desde  = searchParams.desde && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.desde) ? searchParams.desde : iso(hace90);
  const hasta  = searchParams.hasta && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.hasta) ? searchParams.hasta : iso(ahora);

  const supabase = createClient();
  const [
    { data: cuentas }, { data: saldos, error: errSaldos }, { data: categorias }, { data: deudas }, { data: pagos }, { data: movimientos }, config,
  ] = await Promise.all([
    supabase.from('tes_cuentas').select('*').order('orden').order('created_at'),
    supabase.rpc('tes_saldos'),
    supabase.from('tes_categorias').select('*').order('tipo').order('nombre'),
    supabase.from('tes_deudas').select('*').order('anulada').order('vence_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    // Pagos de deudas (todos los egresos con deuda_id, sin filtro de período: el saldo es histórico)
    supabase.from('tes_movimientos').select('deuda_id, monto').not('deuda_id', 'is', null),
    supabase
      .from('tes_movimientos')
      .select('*, cuenta:tes_cuentas!cuenta_id(nombre), destino:tes_cuentas!cuenta_destino_id(nombre), categoria:tes_categorias(nombre), deuda:tes_deudas(acreedor), autor:profiles!created_by(nombre)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000),
    getAppConfig(),
  ]);

  // Saldo pendiente por deuda = monto − pagos
  const pagado = new Map<string, number>();
  for (const p of (pagos ?? []) as { deuda_id: string; monto: number }[]) {
    pagado.set(p.deuda_id, (pagado.get(p.deuda_id) ?? 0) + Number(p.monto));
  }
  const deudasVista: DeudaVista[] = ((deudas ?? []) as TesDeuda[]).map(d => ({
    ...d,
    monto: Number(d.monto),
    pagado: pagado.get(d.id) ?? 0,
    saldo: Math.max(Number(d.monto) - (pagado.get(d.id) ?? 0), 0),
  }));

  const movimientosVista: MovimientoVista[] = ((movimientos ?? []) as any[]).map(m => ({
    ...(m as TesMovimiento),
    monto: Number(m.monto),
    monto_destino: m.monto_destino != null ? Number(m.monto_destino) : null,
    tipo_cambio: m.tipo_cambio != null ? Number(m.tipo_cambio) : null,
    cuenta_nombre:    m.cuenta?.nombre ?? '—',
    destino_nombre:   m.destino?.nombre ?? null,
    categoria_nombre: m.categoria?.nombre ?? null,
    deuda_acreedor:   m.deuda?.acreedor ?? null,
    autor_nombre:     m.autor?.nombre ?? null,
  }));

  return (
    <TesoreriaClient
      cuentas={(cuentas ?? []) as TesCuenta[]}
      saldos={((saldos ?? []) as TesSaldo[]).map(s => ({ ...s, saldo: Number(s.saldo) }))}
      categorias={(categorias ?? []) as TesCategoria[]}
      deudas={deudasVista}
      movimientos={movimientosVista}
      cuentaCobros={config.tes_cuenta_cobros}
      desde={desde}
      hasta={hasta}
      errorMsg={errSaldos ? 'No se pudo cargar Tesorería. ¿Se ejecutó tesoreria.sql en Supabase?' : null}
    />
  );
}
