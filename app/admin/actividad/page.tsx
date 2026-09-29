import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ActividadClient, type EntradaActividad } from './ActividadClient';

export const metadata = { title: 'Actividad' };

interface Props {
  searchParams: { desde?: string; hasta?: string };
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Admin → Actividad: lo que hacen los socios (actividad_socios) y los admins
// (audit_log) en un solo listado, con filtros y gráfico por período.
export default async function ActividadPage({ searchParams }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  // Default: últimos 30 días
  const ahora  = new Date();
  const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 30);
  const desde  = searchParams.desde ? new Date(`${searchParams.desde}T00:00:00`) : hace30;
  const hasta  = searchParams.hasta ? new Date(`${searchParams.hasta}T23:59:59.999`) : ahora;

  const supabase = createClient();
  const [{ data: socios }, { data: admins }] = await Promise.all([
    supabase
      .from('actividad_socios')
      .select('id, accion, detalle, created_at, socio:profiles!socio_id(id, nombre)')
      .gte('created_at', desde.toISOString())
      .lte('created_at', hasta.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('audit_log')
      .select('id, accion, recurso, metadata, fecha, admin:profiles!admin_id(id, nombre), socio:profiles!socio_afectado_id(id, nombre)')
      .gte('fecha', desde.toISOString())
      .lte('fecha', hasta.toISOString())
      .order('fecha', { ascending: false })
      .limit(2000),
  ]);

  // Formato único para el client
  const entradas: EntradaActividad[] = [
    ...((socios ?? []) as any[]).map(a => ({
      id:        `s-${a.id}`,
      origen:    'socio' as const,
      fecha:     a.created_at,
      accion:    a.accion,
      recurso:   null,
      detalle:   a.detalle,
      actor:     a.socio ? { id: a.socio.id, nombre: a.socio.nombre } : null,
      afectado:  null,
    })),
    ...((admins ?? []) as any[]).map(a => ({
      id:        `a-${a.id}`,
      origen:    'admin' as const,
      fecha:     a.fecha,
      accion:    a.accion,
      recurso:   a.recurso,
      detalle:   a.metadata,
      actor:     a.admin ? { id: a.admin.id, nombre: a.admin.nombre } : null,
      afectado:  a.socio ? { id: a.socio.id, nombre: a.socio.nombre } : null,
    })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <ActividadClient
      entradas={entradas}
      desde={iso(desde)}
      hasta={iso(hasta)}
    />
  );
}
