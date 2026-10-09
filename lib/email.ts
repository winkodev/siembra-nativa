import nodemailer from 'nodemailer';
import { createServiceClient } from '@/lib/supabase/server';
import type { EventoAviso, ProveedorEmail } from '@/lib/avisos';

// ------------------------------------------------------------
// Avisos por email a los ADMINS (no a los socios).
// Dos métodos de envío, se elige en Configuración → Avisos:
//   - resend: API de Resend (RESEND_API_KEY + EMAIL_FROM)
//   - gmail : SMTP de Gmail con contraseña de aplicación (GMAIL_USER + GMAIL_APP_PASSWORD)
//   - auto  : Gmail si está configurado, si no Resend
// Best-effort: si falta la configuración o falla el envío, no pasa nada;
// la acción que lo origina nunca se interrumpe.
// ------------------------------------------------------------

// Qué métodos tienen sus variables cargadas en el servidor
export function proveedoresDisponibles(): Record<Exclude<ProveedorEmail, 'auto'>, boolean> {
  return {
    resend: Boolean(process.env.RESEND_API_KEY),
    gmail:  Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  };
}

function resolverProveedor(preferido: ProveedorEmail): Exclude<ProveedorEmail, 'auto'> | null {
  const disp = proveedoresDisponibles();
  if (preferido === 'gmail')  return disp.gmail  ? 'gmail'  : null;
  if (preferido === 'resend') return disp.resend ? 'resend' : null;
  return disp.gmail ? 'gmail' : disp.resend ? 'resend' : null;
}

async function enviarPorResend(to: string[], subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Siembra Nativa Club <onboarding@resend.dev>',
      to, subject, html,
    }),
  });
  return res.ok;
}

async function enviarPorGmail(to: string[], subject: string, html: string): Promise<boolean> {
  const transporte = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporte.sendMail({
    from: `Siembra Nativa Club <${process.env.GMAIL_USER}>`,
    to: to.join(', '),
    subject,
    html,
  });
  return true;
}

// Envío con el método elegido. Devuelve false si no hay método disponible o falla.
export async function enviarEmail(
  to: string[], subject: string, html: string, preferido: ProveedorEmail = 'auto'
): Promise<boolean> {
  if (to.length === 0) return false;
  const proveedor = resolverProveedor(preferido);
  if (!proveedor) return false;
  try {
    return proveedor === 'gmail'
      ? await enviarPorGmail(to, subject, html)
      : await enviarPorResend(to, subject, html);
  } catch {
    return false;
  }
}

// Plantilla base del club: título, líneas de detalle y botón al panel
function plantillaAdmin(titulo: string, lineas: string[], enlace: { label: string; href: string }): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const esc  = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="color: #083D3A; margin-bottom: 4px;">Siembra Nativa Club</h2>
      <p style="font-size: 17px; font-weight: bold; margin: 12px 0 8px;">${esc(titulo)}</p>
      <div style="background:#f6f6f6; border-radius:8px; padding:12px 16px; margin: 12px 0;">
        ${lineas.map(l => `<p style="margin: 4px 0;">${esc(l)}</p>`).join('')}
      </div>
      <p>
        <a href="${base}${enlace.href}"
           style="display:inline-block; background:#F3A707; color:#083D3A; font-weight:bold; padding:10px 22px; border-radius:8px; text-decoration:none;">
          ${esc(enlace.label)}
        </a>
      </p>
      <p style="font-size: 12px; color: #888;">Aviso automático para administradores. Se configura en Configuración → Avisos.</p>
    </div>
  `;
}

// Manda el aviso a los admins configurados si el evento está activado.
// Se llama desde las server actions (service client: lee la config sin depender del rol del socio).
export async function avisarAdmins(
  evento: EventoAviso,
  titulo: string,
  lineas: string[],
  enlace: { label: string; href: string }
): Promise<void> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from('configuracion_app')
      .select('clave, valor')
      .in('clave', ['avisos_emails', 'avisos_proveedor', `avisos_${evento}`]);

    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.clave] = r.valor;

    if (map[`avisos_${evento}`] !== 'true') return;
    const emails = (map['avisos_emails'] ?? '')
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return;

    const preferido = (map['avisos_proveedor'] ?? 'auto') as ProveedorEmail;
    await enviarEmail(emails, `[Club] ${titulo}`, plantillaAdmin(titulo, lineas, enlace), preferido);
  } catch {
    // Nunca interrumpe la acción principal
  }
}

// Email de prueba desde Configuración → Avisos (solo admin, lo llama la action)
export async function enviarEmailPrueba(to: string, preferido: ProveedorEmail): Promise<boolean> {
  return enviarEmail(
    [to],
    '[Club] Prueba de avisos',
    plantillaAdmin('Prueba de avisos por email', ['Si leés esto, los avisos están funcionando.'], { label: 'Ir al panel', href: '/admin/dashboard' }),
    preferido
  );
}
