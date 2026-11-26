import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GestionClient } from './GestionClient';
import type { Tarea } from '@/lib/types/database';

export const metadata = { title: 'Gestión' };

// Gestión: tareas con vencimiento, solo superadmin
export default async function GestionPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  const supabase = createClient();
  const [{ data: tareas, error }, { data: deudas }, { data: pagos }] = await Promise.all([
    supabase.from('tareas').select('*').order('vence_at', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('tes_deudas').select('id, acreedor, moneda, monto').eq('sentido', 'a_pagar').eq('anulada', false).order('acreedor'),
    supabase.from('tes_movimientos').select('deuda_id, monto').not('deuda_id', 'is', null),
  ]);
  // Deudas con saldo: una tarea mensual puede ser su cuota
  const conSaldo = (deudas ?? []).map(d => ({
    id: d.id, acreedor: d.acreedor, moneda: d.moneda,
    saldo: Number(d.monto) - (pagos ?? []).filter(p => p.deuda_id === d.id).reduce((a, p) => a + Number(p.monto), 0),
  })).filter(d => d.saldo > 0);

  return (
    <GestionClient
      tareas={(tareas ?? []) as Tarea[]}
      deudas={conSaldo}
      errorMsg={error ? 'No se pudo cargar Gestión. ¿Se ejecutó gestion-tareas.sql en Supabase?' : null}
    />
  );
}
