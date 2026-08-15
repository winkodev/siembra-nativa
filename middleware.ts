import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Rutas públicas que no requieren autenticación
const RUTAS_PUBLICAS = ['/', '/login', '/registro', '/auth/callback'];

// Rutas según rol
const RUTAS_SOCIO = ['/socio'];
const RUTAS_ADMIN = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Refrescar sesión (SIEMPRE, incluso en rutas públicas)
  const { supabaseResponse, user, supabase } = await updateSession(request);

  const esPublica = RUTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'));

  // Usuario no autenticado intentando acceder a rutas protegidas
  if (!user && !esPublica) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuario autenticado: obtener su rol para redirección correcta
  if (user) {
    // Redirigir desde rutas de auth a su dashboard correspondiente
    if (pathname === '/login' || pathname === '/registro') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol, estado')
        .eq('id', user.id)
        .single();

      if (profile?.estado === 'inactivo') {
        return NextResponse.redirect(new URL('/inactivo', request.url));
      }

      const destino = profile?.rol === 'admin' ? '/admin/dashboard' : '/socio/dashboard';
      return NextResponse.redirect(new URL(destino, request.url));
    }

    // Socio intentando acceder a rutas de admin
    const intentaAdmin = RUTAS_ADMIN.some(r => pathname.startsWith(r));
    if (intentaAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (profile?.rol !== 'admin') {
        return NextResponse.redirect(new URL('/socio/dashboard', request.url));
      }
    }

    // Admin intentando acceder a rutas de socio (permitido, por si necesita revisar)
    // No se bloquea, solo se documenta el intento
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Excluir archivos estáticos y rutas internas de Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
