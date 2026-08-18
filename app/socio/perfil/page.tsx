import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/server';
import { ReprocannOnboardingClient } from './ReprocannOnboardingClient';
import { CambiarPassword } from '@/components/auth/CambiarPassword';

export default async function PerfilPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  return (
    <>
      <ReprocannOnboardingClient profile={profile} />
      {/* Seguridad de la cuenta */}
      <div className="max-w-2xl mx-auto mt-6">
        <CambiarPassword />
      </div>
    </>
  );
}
