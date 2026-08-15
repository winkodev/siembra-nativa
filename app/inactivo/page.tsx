import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { Logo } from '@/components/brand/Logo';
import { ShieldOff } from 'lucide-react';

export default async function InactivoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Logo variant="full" size="md" />
      </div>

      <div className="glass-card max-w-sm w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
          <ShieldOff className="w-7 h-7 text-red-400" />
        </div>

        <h1 className="font-avigea text-2xl text-foreground">Cuenta desactivada</h1>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu acceso a Siembra Nativa Club fue desactivado por un administrador.
          Si creés que es un error, contactate con el club.
        </p>

        <form action={logout}>
          <button type="submit" className="btn-secondary w-full py-3 mt-2">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
