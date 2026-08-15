import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConfiguracionClient } from './ConfiguracionClient';
import { getAppConfig } from '@/lib/supabase/config';
import type { Ubicacion, FranjaHoraria } from '@/lib/types/database';

export const metadata = { title: 'Configuración' };

export default async function ConfiguracionPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();

  const [{ data: ubicaciones }, { data: franjas }, config, { data: actividad }] = await Promise.all([
    supabase.from('ubicaciones').select('*').order('nombre'),
    supabase.from('franjas_horarias').select('*').order('created_at'),
    getAppConfig(),
    // Últimas 100 acciones de admin (audit_log), con nombres resueltos
    supabase
      .from('audit_log')
      .select('*, admin:profiles!admin_id(nombre), socio:profiles!socio_afectado_id(nombre)')
      .order('fecha', { ascending: false })
      .limit(100),
  ]);

  return (
    <ConfiguracionClient
      ubicaciones={(ubicaciones as Ubicacion[]) ?? []}
      franjas={(franjas as FranjaHoraria[]) ?? []}
      config={config}
      actividad={(actividad as any[]) ?? []}
    />
  );
}
