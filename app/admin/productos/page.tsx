import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminProductosClient } from './AdminProductosClient';
import type { Producto } from '@/lib/types/database';

export const metadata = { title: 'Gestión de productos' };

export default async function AdminProductosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false });

  return <AdminProductosClient productos={(productos as Producto[]) ?? []} />;
}
