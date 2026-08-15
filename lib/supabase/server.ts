import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

// Cliente admin con service role — bypasea RLS, usar solo en server actions de admin
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Cliente para uso en Server Components y Route Handlers
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component no puede setear cookies (solo lo puede hacer middleware/route handler)
          }
        },
      },
    }
  );
}

// -------------------------------------------------------
// Helpers de servidor
// -------------------------------------------------------

/** Obtiene el usuario actual o null */
export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Obtiene el perfil completo del usuario actual o null */
export async function getProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

/** Genera una signed URL de corta duración para un certificado REPROCANN */
export async function getCertificadoSignedUrl(
  path: string,
  adminId: string,
  socioId: string
): Promise<string | null> {
  const supabase = createClient();

  // Registrar acceso en audit_log (cumplimiento Ley 25.326)
  await supabase.from('audit_log').insert({
    admin_id: adminId,
    accion: 'ver_certificado',
    recurso: 'reprocann_certificado',
    socio_afectado_id: socioId,
    metadata: { path },
  });

  // URL válida por 5 minutos
  const { data } = await supabase.storage
    .from('certificados-reprocann')
    .createSignedUrl(path, 300);

  return data?.signedUrl ?? null;
}
