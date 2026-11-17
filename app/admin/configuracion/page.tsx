import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConfiguracionClient } from './ConfiguracionClient';
import { getAppConfig } from '@/lib/supabase/config';
import { proveedoresDisponibles, estadoCredenciales } from '@/lib/email';
import type { Ubicacion, FranjaHoraria, FechaBloqueada } from '@/lib/types/database';

export const metadata = { title: 'Configuración' };

export default async function ConfiguracionPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();

  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: ubicaciones }, { data: franjas }, config, { data: bloqueos }, { data: pedidosActivos }] = await Promise.all([
    supabase.from('ubicaciones').select('*').order('nombre'),
    supabase.from('franjas_horarias').select('*').order('created_at'),
    getAppConfig(),
    // Días bloqueados de hoy en adelante (calendario de entregas)
    supabase.from('fechas_bloqueadas').select('*').gte('fecha', hoy).order('fecha'),
    // Pedidos activos con fecha de entrega, para avisar antes de bloquear un día
    supabase.from('pedidos').select('entrega_fecha').in('estado', ['pendiente', 'aprobado']).gte('entrega_fecha', hoy),
  ]);
  const pedidosPorFecha: Record<string, number> = {};
  for (const p of (pedidosActivos ?? []) as { entrega_fecha: string | null }[]) {
    if (p.entrega_fecha) pedidosPorFecha[p.entrega_fecha] = (pedidosPorFecha[p.entrega_fecha] ?? 0) + 1;
  }

  return (
    <ConfiguracionClient
      ubicaciones={(ubicaciones as Ubicacion[]) ?? []}
      franjas={(franjas as FranjaHoraria[]) ?? []}
      bloqueos={(bloqueos as FechaBloqueada[]) ?? []}
      pedidosPorFecha={pedidosPorFecha}
      config={config}
      superadmin={Boolean(profile.superadmin)}
      proveedoresEmail={await proveedoresDisponibles()}
      credencialesEmail={await estadoCredenciales()}
    />
  );
}
