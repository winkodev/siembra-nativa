import { createClient } from '@/lib/supabase/server';
import { InventarioClient } from './InventarioClient';
import type { Metadata } from 'next';
import type { Genetica, Stock, Ubicacion } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Inventario' };

export default async function InventarioPage() {
  const supabase = createClient();

  const [{ data: geneticas }, { data: stock }, { data: ubicaciones }, { data: pendientes }] = await Promise.all([
    supabase.from('geneticas').select('*').order('nombre'),
    supabase.from('stock').select('*, geneticas(nombre, tipo)').order('fecha_ingreso', { ascending: false }),
    supabase.from('ubicaciones').select('*').eq('activa', true).order('nombre'),
    // Items de flores en pedidos pendientes (gramos reservados, aún sin descontar)
    supabase
      .from('pedido_items')
      .select('genetica_id, cantidad_gramos, pedidos!inner(estado)')
      .eq('pedidos.estado', 'pendiente')
      .not('genetica_id', 'is', null),
  ]);

  // Gramos reservados por genética
  const reservas: Record<string, number> = {};
  for (const item of (pendientes ?? []) as { genetica_id: string | null; cantidad_gramos: number | null }[]) {
    if (item.genetica_id) {
      reservas[item.genetica_id] = (reservas[item.genetica_id] ?? 0) + (item.cantidad_gramos ?? 0);
    }
  }

  return (
    <InventarioClient
      geneticas={(geneticas ?? []) as Genetica[]}
      stock={(stock ?? []) as (Stock & { geneticas: { nombre: string; tipo: string } })[]}
      ubicaciones={(ubicaciones ?? []) as Ubicacion[]}
      reservas={reservas}
    />
  );
}
