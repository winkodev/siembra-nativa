import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConfiguracionClient } from './ConfiguracionClient';
import { getAppConfig } from '@/lib/supabase/config';
import { proveedoresDisponibles, estadoCredenciales } from '@/lib/email';
import type { Ubicacion, FranjaHoraria } from '@/lib/types/database';

export const metadata = { title: 'Configuración' };

export default async function ConfiguracionPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();

  const [{ data: ubicaciones }, { data: franjas }, config] = await Promise.all([
    supabase.from('ubicaciones').select('*').order('nombre'),
    supabase.from('franjas_horarias').select('*').order('created_at'),
    getAppConfig(),
  ]);

  return (
    <ConfiguracionClient
      ubicaciones={(ubicaciones as Ubicacion[]) ?? []}
      franjas={(franjas as FranjaHoraria[]) ?? []}
      config={config}
      superadmin={Boolean(profile.superadmin)}
      proveedoresEmail={await proveedoresDisponibles()}
      credencialesEmail={await estadoCredenciales()}
    />
  );
}
