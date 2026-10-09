import { createServiceClient } from '@/lib/supabase/server';

// ------------------------------------------------------------
// Avisos por email a los ADMINS (no a los socios), vía Resend.
// Las direcciones y qué eventos avisan se configuran en
// Configuración → Avisos (claves avisos_* en configuracion_app).
// Best-effort: si falta la clave de Resend o falla el envío, no pasa
// nada; la acción que lo origina nunca se interrumpe.
// ------------------------------------------------------------

import type { EventoAviso } from '@/lib/avisos';

// Envío crudo por Resend. Devuelve false si no está configurado o falla.
export async function enviarEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || to.length === 0) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Siembra Nativa Club <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    return res.ok;
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
      .in('clave', ['avisos_emails', `avisos_${evento}`]);

    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.clave] = r.valor;

    if (map[`avisos_${evento}`] !== 'true') return;
    const emails = (map['avisos_emails'] ?? '')
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return;

    await enviarEmail(emails, `[Club] ${titulo}`, plantillaAdmin(titulo, lineas, enlace));
  } catch {
    // Nunca interrumpe la acción principal
  }
}
