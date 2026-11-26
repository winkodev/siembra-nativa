import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cargarObjetivos, resumenObjetivos } from '@/lib/objetivos';
import { ObjetivosClient } from './ObjetivosClient';

export const metadata = { title: 'Objetivos' };

// Objetivos: cuánta plata hay que juntar contra la que hay. Solo superadmin.
export default async function ObjetivosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');
  if (!profile.superadmin) redirect('/admin/dashboard');

  const objetivos = await cargarObjetivos(createClient());
  return <ObjetivosClient objetivos={objetivos} resumen={objetivos ? resumenObjetivos(objetivos) : null} />;
}
