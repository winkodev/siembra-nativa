import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminNewsletterClient } from './AdminNewsletterClient';
import type { Newsletter } from '@/lib/types/database';

export const metadata = { title: 'Newsletter' };

export default async function AdminNewsletterPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  const { data: articulos } = await supabase
    .from('newsletter')
    .select('*')
    .order('created_at', { ascending: false });

  return <AdminNewsletterClient articulos={(articulos as Newsletter[]) ?? []} />;
}
