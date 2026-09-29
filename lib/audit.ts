import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Registra una acción de admin en audit_log.
 * Best-effort: si el log falla, nunca interrumpe la operación principal.
 */
export async function registrarAccion(
  supabase: SupabaseClient<Database>,
  accion: string,
  recurso: string,
  metadata?: Record<string, unknown>,
  socioAfectadoId?: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_log').insert({
      admin_id: user.id,
      accion,
      recurso,
      metadata: metadata ?? null,
      socio_afectado_id: socioAfectadoId ?? null,
    });
  } catch {
    // El log de auditoría nunca debe romper la acción que lo origina
  }
}

/**
 * Registra una acción de SOCIO en actividad_socios (Admin → Actividad).
 * Se escribe con el service client: el socio no tiene permisos sobre la tabla.
 * Best-effort: nunca interrumpe la acción principal.
 */
export async function registrarActividadSocio(
  socioId: string,
  accion: string,
  detalle?: Record<string, unknown>
): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    await createServiceClient().from('actividad_socios').insert({
      socio_id: socioId,
      accion,
      detalle: detalle ?? null,
    });
  } catch {
    // El log nunca debe romper la acción que lo origina
  }
}
