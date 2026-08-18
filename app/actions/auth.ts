'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/types/database';

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export async function login(prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const raw = Object.fromEntries(formData);
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { ok: false, error: 'Email o contraseña incorrectos' };
    }
    return { ok: false, error: 'Error al iniciar sesión. Intentá de nuevo.' };
  }

  // Verificar que el socio no esté desactivado
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('estado, rol')
      .eq('id', user.id)
      .single();

    if (profile?.estado === 'inactivo') {
      await supabase.auth.signOut();
      return { ok: false, error: 'Tu cuenta fue desactivada. Contactá al club para más información.' };
    }

    if (profile?.rol === 'admin') redirect('/admin/dashboard');
  }

  redirect('/socio/dashboard');
}

// Nota: el registro público fue deshabilitado — las altas las hace el
// club desde /admin/socios (ver app/actions/usuarios.ts)

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
