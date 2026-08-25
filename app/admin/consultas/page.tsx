import { createClient } from '@/lib/supabase/server';
import { AdminConsultasClient } from './AdminConsultasClient';
import type { ConsultaConSocio } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Consultas' };

export default async function AdminConsultasPage() {
  const supabase = createClient();

  // RLS: solo admin llega acá (middleware) y ve todas las consultas
  const { data: consultas } = await supabase
    .from('consultas')
    .select('*, profiles!consultas_socio_id_fkey(nombre, email, telefono)')
    .order('created_at', { ascending: false });

  return <AdminConsultasClient consultas={(consultas ?? []) as ConsultaConSocio[]} />;
}
