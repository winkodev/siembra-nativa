'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/types/database';

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

const registroSchema = z.object({
  nombre:          z.string().min(2, 'El nombre es requerido'),
  email:           z.string().email('Email inválido'),
  password:        z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
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

export async function registro(prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const raw = Object.fromEntries(formData);
  const parsed = registroSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { nombre: parsed.data.nombre },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { ok: false, error: 'Ese email ya está registrado. ¿Querés iniciar sesión?' };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
