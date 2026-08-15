'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/types/database';

const reprocannSchema = z.object({
  reprocann_numero:      z.string().min(4, 'Número inválido'),
  reprocann_categoria:   z.enum(['paciente_cultiva', 'tercero_cultivador', 'ong']),
  reprocann_vencimiento: z.string().refine(v => !isNaN(Date.parse(v)), 'Fecha inválida'),
});

/** Guardar/actualizar datos de REPROCANN (sin certificado) */
export async function guardarReprocann(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const raw = Object.fromEntries(formData);
  const parsed = reprocannSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      reprocann_numero:      parsed.data.reprocann_numero,
      reprocann_categoria:   parsed.data.reprocann_categoria,
      reprocann_vencimiento: parsed.data.reprocann_vencimiento,
      reprocann_estado:      'pendiente', // Vuelve a pendiente cuando se actualiza
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Error al guardar datos' };
  return { ok: true, data: undefined };
}

/** Subir certificado PDF/imagen al bucket privado */
export async function subirCertificado(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const archivo = formData.get('certificado') as File | null;
  if (!archivo || archivo.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo' };
  }

  // Validar tipo y tamaño
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!tiposPermitidos.includes(archivo.type)) {
    return { ok: false, error: 'Solo se aceptan PDF, JPG, PNG o WEBP' };
  }
  if (archivo.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'El archivo no puede superar 10 MB' };
  }

  // Ruta: {user_id}/{timestamp}-{nombre_original}
  const ext = archivo.name.split('.').pop() ?? 'pdf';
  const path = `${user.id}/${Date.now()}-certificado.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('certificados-reprocann')
    .upload(path, archivo, { upsert: true });

  if (uploadError) {
    return { ok: false, error: 'Error al subir el archivo. Intentá de nuevo.' };
  }

  // Datos extraídos del certificado (editables por el socio antes de subir)
  const vencimiento = (formData.get('reprocann_vencimiento') as string | null)?.trim() || null;
  const numero      = (formData.get('reprocann_numero') as string | null)?.trim() || null;
  const categoriaRaw = (formData.get('reprocann_categoria') as string | null)?.trim() || null;
  const categoria = (['paciente_cultiva', 'tercero_cultivador', 'ong'] as const).includes(categoriaRaw as never)
    ? (categoriaRaw as 'paciente_cultiva' | 'tercero_cultivador' | 'ong')
    : null;

  // Validar vencimiento si vino cargado
  if (vencimiento && isNaN(Date.parse(vencimiento))) {
    return { ok: false, error: 'La fecha de vencimiento no es válida' };
  }

  // Guardar la ruta + datos del certificado (NUNCA la URL pública)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      reprocann_certificado_path: path,
      reprocann_estado: 'pendiente',
      ...(vencimiento ? { reprocann_vencimiento: vencimiento } : {}),
      ...(numero      ? { reprocann_numero: numero } : {}),
      ...(categoria   ? { reprocann_categoria: categoria } : {}),
    })
    .eq('id', user.id);

  if (updateError) {
    return { ok: false, error: 'Error al guardar referencia del certificado' };
  }

  revalidatePath('/socio/perfil');
  return { ok: true, data: undefined };
}

/** Socio: ver su propio certificado (URL firmada 5 min) */
export async function verMiCertificado(): Promise<ActionResponse<{ url: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('reprocann_certificado_path')
    .eq('id', user.id)
    .single();

  if (!profile?.reprocann_certificado_path) return { ok: false, error: 'No hay certificado cargado' };

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from('certificados-reprocann')
    .createSignedUrl(profile.reprocann_certificado_path, 300);

  if (error || !data) return { ok: false, error: 'No se pudo acceder al certificado' };
  return { ok: true, data: { url: data.signedUrl } };
}

/** Admin: aprobar o rechazar REPROCANN */
export async function revisarReprocann(
  socioId: string,
  nuevoEstado: 'aprobado' | 'rechazado'
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  // Verificar que el usuario actual es admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (adminProfile?.rol !== 'admin') {
    return { ok: false, error: 'Sin permisos' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ reprocann_estado: nuevoEstado })
    .eq('id', socioId);

  if (error) return { ok: false, error: 'Error al actualizar estado' };

  // Registrar en audit_log
  await supabase.from('audit_log').insert({
    admin_id: user.id,
    accion: nuevoEstado === 'aprobado' ? 'aprobar_reprocann' : 'rechazar_reprocann',
    recurso: 'reprocann_estado',
    socio_afectado_id: socioId,
  });

  return { ok: true, data: undefined };
}
