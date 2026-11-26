import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cargarPersonal } from '@/lib/personal-datos';
import { PersonalClient, type GeneticaRetiro } from './PersonalClient';

export const metadata = { title: 'Personal' };

// Personal: sueldos, aumentos y retiros. Solo superadmin.
export default async function PersonalPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  const supabase = createClient();
  const [personal, { data: admins }, { data: disponibles }] = await Promise.all([
    cargarPersonal(supabase),
    supabase.from('profiles').select('id, nombre').eq('rol', 'admin').order('nombre'),
    // Neto de lo reservado por pedidos pendientes
    supabase.from('stock_publico').select('genetica_id, nombre, stock_total_gramos, precio_gramo').gt('stock_total_gramos', 0).order('nombre'),
  ]);

  return (
    <PersonalClient
      personal={personal ?? []}
      admins={admins ?? []}
      geneticas={((disponibles ?? []) as GeneticaRetiro[]).map(g => ({ ...g, stock_total_gramos: Number(g.stock_total_gramos), precio_gramo: g.precio_gramo != null ? Number(g.precio_gramo) : null }))}
      errorMsg={personal ? null : 'No se pudo cargar Personal. ¿Se ejecutó personal-costos-objetivos.sql en Supabase?'}
    />
  );
}
