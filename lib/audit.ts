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
