'use server';

import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, RolUsuario } from '@/lib/types/database';

// Verifica que quien ejecuta sea admin y devuelve su ID
async function verificarAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return data?.rol === 'admin' ? user.id : null;
}

// Contraseña temporal legible (sin caracteres ambiguos: 0/O, 1/l/I)
function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  return 'SN-' + Array.from(bytes, b => chars[b % chars.length]).join('');
}

export type ModoAlta = 'invitacion' | 'password';

export async function crearUsuario(
  nombre: string,
  email: string,
  rol: RolUsuario,
  modo: ModoAlta
): Promise<ActionResponse<{ password: string | null }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  if (!nombre.trim()) return { ok: false, error: 'El nombre es obligatorio' };
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { ok: false, error: 'Email inválido' };

  const service = createServiceClient();
  const emailLimpio = email.trim().toLowerCase();
  let userId: string;
  let password: string | null = null;

  if (modo === 'invitacion') {
    // Supabase envía el email de invitación; el usuario define su
    // contraseña al entrar (via /establecer-password)
    const { data, error } = await service.auth.admin.inviteUserByEmail(emailLimpio, {
      data: { nombre: nombre.trim() },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/establecer-password`,
    });
    if (error || !data.user) {
      if (error?.message.includes('already been registered')) {
        return { ok: false, error: 'Ese email ya está registrado' };
      }
      return { ok: false, error: 'Error al enviar la invitación: ' + (error?.message ?? '') };
    }
    userId = data.user.id;
  } else {
    // Alta con contraseña temporal: el admin la comparte por su cuenta
    password = generarPasswordTemporal();
    const { data, error } = await service.auth.admin.createUser({
      email: emailLimpio,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre.trim() },
    });
    if (error || !data.user) {
      if (error?.message.includes('already been registered')) {
        return { ok: false, error: 'Ese email ya está registrado' };
      }
      return { ok: false, error: 'Error al crear el usuario: ' + (error?.message ?? '') };
    }
    userId = data.user.id;
  }

  // El trigger de la base creó el perfil como socio: ajustar rol y datos
  const { error: perfilError } = await service
    .from('profiles')
    .update({ rol, nombre: nombre.trim(), email: emailLimpio })
    .eq('id', userId);

  if (perfilError) return { ok: false, error: 'Usuario creado, pero falló la asignación de rol' };

  await registrarAccion(createClient(), 'crear_usuario', 'usuarios', { email: emailLimpio, rol, modo }, userId);
  revalidatePath('/admin/socios');
  return { ok: true, data: { password } };
}

export async function cambiarRolUsuario(userId: string, rol: RolUsuario): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  // Protecciones: no auto-degradarse ni dejar el club sin admins
  if (rol === 'socio') {
    if (userId === adminId) {
      return { ok: false, error: 'No podés quitarte el rol de admin a vos mismo' };
    }
    const service = createServiceClient();
    const { count } = await service
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'admin');
    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'No se puede quitar: es el único administrador' };
    }
  }

  const service = createServiceClient();
  const { error } = await service.from('profiles').update({ rol }).eq('id', userId);
  if (error) return { ok: false, error: 'Error al cambiar el rol' };

  await registrarAccion(
    createClient(),
    rol === 'admin' ? 'promover_admin' : 'degradar_admin',
    'usuarios',
    undefined,
    userId
  );
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}