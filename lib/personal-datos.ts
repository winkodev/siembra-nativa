import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Personal, PersonalSueldo, PersonalPago, PersonalRetiro } from '@/lib/types/database';
import type { PersonalVista } from '@/lib/personal';

// Carga el personal con sueldos, pagos y retiros (la RLS exige superadmin).
// null si todavía no se ejecutó el SQL.
export async function cargarPersonal(supabase: SupabaseClient<Database>): Promise<PersonalVista[] | null> {
  const [{ data: personal, error }, { data: sueldos }, { data: pagos }, { data: retiros }, { data: aplic }] = await Promise.all([
    supabase.from('personal').select('*').order('activo', { ascending: false }).order('nombre'),
    supabase.from('personal_sueldos').select('*').order('desde', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('personal_pagos').select('*').order('periodo').order('created_at'),
    supabase.from('personal_retiros').select('*, geneticas(nombre)').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('personal_retiro_aplicaciones').select('*'),
  ]);
  if (error) return null;

  // Cobros de los retiros de socios administradores
  const deudas = ((retiros ?? []) as unknown as PersonalRetiro[]).map(r => r.deuda_id).filter((d): d is string => Boolean(d));
  const { data: cobros } = deudas.length > 0
    ? await supabase.from('tes_movimientos').select('deuda_id, monto').in('deuda_id', deudas)
    : { data: [] as { deuda_id: string | null; monto: number }[] };

  const cubierto = new Map<string, number>();
  const sumar = (k: string | null, n: number) => { if (k) cubierto.set(k, (cubierto.get(k) ?? 0) + Number(n)); };
  for (const a of aplic ?? []) sumar(a.retiro_id, a.monto);
  for (const c of cobros ?? []) sumar(c.deuda_id, c.monto);

  return ((personal ?? []) as Personal[]).map(p => ({
    ...p,
    sueldos: ((sueldos ?? []) as PersonalSueldo[]).filter(s => s.personal_id === p.id).map(s => ({ ...s, monto: Number(s.monto) })),
    pagos: ((pagos ?? []) as PersonalPago[]).filter(g => g.personal_id === p.id).map(g => ({
      ...g, base: Number(g.base), extra: Number(g.extra), retiros: Number(g.retiros), monto: Number(g.monto),
    })),
    retiros: ((retiros ?? []) as unknown as (PersonalRetiro & { geneticas: { nombre: string } | null })[])
      .filter(r => r.personal_id === p.id)
      .map(({ geneticas, ...r }) => {
        const total = Number(r.total);
        const cub = cubierto.get(r.deuda_id ?? r.id) ?? 0;
        return {
          ...r, total, gramos: Number(r.gramos), precio_gramo: Number(r.precio_gramo),
          genetica: geneticas?.nombre ?? 'Genética', cubierto: cub, pendiente: Math.max(total - cub, 0),
        };
      }),
  }));
}
