'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResponse } from '@/lib/types/database';

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

  // Guardar solo la ruta (NUNCA la URL pública). El vencimiento no lo carga el
  // socio: lo revisa y completa el admin al aprobar el certificado.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      reprocann_certificado_path: path,
      reprocann_estado: 'pendiente',
    })
    .eq('id', user.id);

  if (updateError) {
    return { ok: false, error: 'Error al guardar referencia del certificado' };
  }

  revalidatePath('/socio/perfil');
  // También el Inicio: su alerta "subí tu certificado" quedaba cacheada
  revalidatePath('/socio/dashboard');
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
