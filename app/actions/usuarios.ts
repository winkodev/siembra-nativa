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

// Envía la contraseña temporal por email vía Resend.
// Devuelve false si no hay RESEND_API_KEY configurada o si falla el envío
// (en ese caso el admin la comparte a mano — el modal se la muestra igual).
async function enviarEmailPasswordTemporal(
  email: string,
  nombre: string,
  password: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Siembra Nativa Club <onboarding@resend.dev>',
        to: [email],
        subject: 'Tu acceso a Siembra Nativa Club',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
            <h2 style="color: #083D3A; margin-bottom: 4px;">Siembra Nativa Club</h2>
            <p>Hola ${nombre},</p>
            <p>Te dimos de alta en la plataforma del club. Entrá con este acceso:</p>
            <p style="margin: 20px 0;">
              <strong>Usuario:</strong> ${email}<br/>
              <strong>Contraseña temporal:</strong>
              <code style="display:inline-block; background:#f3f3f3; border:1px solid #ddd; border-radius:6px; padding:4px 10px; font-size:16px; letter-spacing:1px;">${password}</code>
            </p>
            <p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
                 style="display:inline-block; background:#F3A707; color:#083D3A; font-weight:bold; padding:10px 22px; border-radius:8px; text-decoration:none;">
                Entrar al club
              </a>
            </p>
            <p style="font-size: 13px; color: #666;">
              Por seguridad, cambiá tu contraseña desde tu perfil al entrar.
            </p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ModoAlta = 'invitacion' | 'password';

export async function crearUsuario(
  nombre: string,
  email: string,
  rol: RolUsuario,
  modo: ModoAlta
): Promise<ActionResponse<{ password: string | null; email_enviado: boolean }>> {
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

  // Con contraseña temporal: intentar enviarla por email (Resend)
  let emailEnviado = modo === 'invitacion';
  if (modo === 'password' && password) {
    emailEnviado = await enviarEmailPasswordTemporal(emailLimpio, nombre.trim(), password);
  }

  await registrarAccion(createClient(), 'crear_usuario', 'usuarios', { email: emailLimpio, rol, modo }, userId);
  revalidatePath('/admin/socios');
  return { ok: true, data: { password, email_enviado: emailEnviado } };
}

// Cambia la contraseña de OTRO usuario admin (el rol se define solo al
// crear el usuario; no hay promoción/degradación desde la app)
export async function cambiarPasswordAdmin(userId: string, nueva: string): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };
  if (nueva.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };

  const service = createServiceClient();

  // Solo aplica a cuentas admin (los socios cambian la suya desde su perfil)
  const { data: perfil } = await service.from('profiles').select('rol').eq('id', userId).single();
  if (perfil?.rol !== 'admin') return { ok: false, error: 'Esta acción es solo para cuentas admin' };

  const { error } = await service.auth.admin.updateUserById(userId, { password: nueva });
  if (error) return { ok: false, error: 'Error al cambiar la contraseña' };

  await registrarAccion(createClient(), 'cambiar_password_admin', 'usuarios', undefined, userId);
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}