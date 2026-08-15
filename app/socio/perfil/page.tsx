import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/server';
import { ReprocannOnboardingClient } from './ReprocannOnboardingClient';

export default async function PerfilPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  return <ReprocannOnboardingClient profile={profile} />;
}
