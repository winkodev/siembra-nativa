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
  const { data: tareas, error } = await supabase
    .from('tareas')
    .select('*')
    .order('vence_at', { ascending: true })
    .order('created_at', { ascending: true });

  return (
    <GestionClient
      tareas={(tareas ?? []) as Tarea[]}
      errorMsg={error ? 'No se pudo cargar Gestión. ¿Se ejecutó gestion-tareas.sql en Supabase?' : null}
    />
  );
}
