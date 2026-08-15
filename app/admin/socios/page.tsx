import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminSociosClient } from './AdminSociosClient';
import type { Profile } from '@/lib/types/database';

export const metadata = { title: 'Gestión de socios' };

export default async function AdminSociosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  // Todos los perfiles: socios y admins (el client los separa por rol)
  const { data: socios } = await supabase
    .from('profiles')
    .select('*')
    .order('fecha_alta', { ascending: false });

  return <AdminSociosClient socios={(socios as Profile[]) ?? []} />;
}
