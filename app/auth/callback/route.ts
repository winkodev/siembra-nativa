import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Callback para magic links y OAuth
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Destino explícito (ej: invitados van a definir su contraseña)
      if (next.startsWith('/') && next !== '/') {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .single();

        const destino = profile?.rol === 'admin' ? '/admin/dashboard' : '/socio/dashboard';
        return NextResponse.redirect(`${origin}${destino}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
