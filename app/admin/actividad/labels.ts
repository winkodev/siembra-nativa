// Etiquetas legibles del log de actividad (admin y socios)

// Traducción legible de cada acción registrada
export const ACCION_LABEL: Record<string, string> = {
  destacar_producto:     'Destacó un producto',
  quitar_destacado_producto: 'Quitó un producto de destacados',
  crear_cupon:           'Creó un cupón para un socio',
  anular_cupon:          'Anuló un cupón',
  editar_datos_pago:     'Cambió los datos de pago (alias / CBU)',
  editar_config:         'Editó la configuración',
  crear_ubicacion:       'Creó una ubicación',
  editar_ubicacion:      'Editó una ubicación',
  eliminar_ubicacion:    'Eliminó una ubicación',
  crear_genetica:        'Creó una genética',
  editar_genetica:       'Editó una genética',
  activar_genetica:      'Activó una genética',
  desactivar_genetica:   'Desactivó una genética',
  eliminar_genetica:     'Eliminó una genética',
  agregar_stock:         'Registró un ingreso de stock',
  editar_stock:          'Editó un ingreso de stock',
  eliminar_stock:        'Eliminó un ingreso de stock',
  crear_producto:        'Creó un producto',
  editar_producto:       'Editó un producto',
  activar_producto:      'Activó un producto',
  desactivar_producto:   'Desactivó un producto',
  eliminar_producto:     'Eliminó un producto',
  pedido_aprobado:       'Aprobó un pedido',
  pedido_entregado:      'Entregó un pedido',
  pedido_cancelado:      'Canceló un pedido',
  crear_articulo:        'Creó un artículo del newsletter',
  editar_articulo:       'Editó un artículo del newsletter',
  publicar_articulo:     'Publicó un artículo',
  despublicar_articulo:  'Despublicó un artículo',
  eliminar_articulo:     'Eliminó un artículo',
  aprobar_reprocann:     'Aprobó documentación REPROCANN',
  rechazar_reprocann:    'Rechazó documentación REPROCANN',
  activar_socio:         'Activó un socio',
  desactivar_socio:      'Desactivó un socio',
  habilitar_compra_manual:    'Habilitó la tienda a mano (sin REPROCANN)',
  deshabilitar_compra_manual: 'Deshabilitó la tienda a mano',
  agregar_nota:          'Agregó una nota de socio',
  ver_certificado:       'Vio un certificado REPROCANN',
  ver_comprobante_pago:  'Vio un comprobante de pago',
  crear_franja:          'Creó una franja horaria',
  editar_franja:         'Editó una franja horaria',
  activar_franja:        'Activó una franja horaria',
  desactivar_franja:     'Desactivó una franja horaria',
  eliminar_franja:       'Eliminó una franja horaria',
  imprimir_pedido:       'Imprimió un pedido',
  check_armado:          'Marcó un pedido como armado',
  descheck_armado:       'Desmarcó el armado de un pedido',
  check_comprobante:     'Chequeó el comprobante de un pedido',
  descheck_comprobante:  'Desmarcó el chequeo de comprobante',
  cambiar_password_admin:'Cambió la contraseña de un admin',
  editar_vencimiento_reprocann: 'Editó el vencimiento REPROCANN',
  crear_usuario:         'Creó un usuario',
  promover_admin:        'Promovió a administrador',
  degradar_admin:        'Quitó rol de administrador',
};

export const RECURSO_LABEL: Record<string, string> = {
  configuracion:          'Configuración',
  ubicaciones:            'Ubicaciones',
  geneticas:              'Genéticas',
  stock:                  'Stock',
  productos:              'Productos',
  pedidos:                'Pedidos',
  newsletter:             'Newsletter',
  reprocann:              'REPROCANN',
  socios:                 'Socios',
  socio_notas:            'Notas',
  reprocann_certificado:  'Certificados',
  comprobante_pago:       'Comprobantes',
  franjas:                'Horarios',
  usuarios:               'Usuarios',
};

// Resumen compacto del metadata (omite ids, que no le dicen nada al admin)
export function resumenMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const partes = Object.entries(metadata)
    .filter(([k, v]) => v != null && !k.endsWith('id') && k !== 'path')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return partes.length ? partes.join(' · ') : null;
}

// Acciones de SOCIO (tabla actividad_socios)
export const ACCION_SOCIO_LABEL: Record<string, string> = {
  guardar_perfil:    'Guardó sus datos personales',
  aceptar_terminos:  'Aceptó los términos y condiciones',
  subir_certificado: 'Subió su certificado REPROCANN',
  crear_pedido:      'Confirmó un pedido',
  subir_comprobante: 'Subió un comprobante de pago',
  crear_consulta:    'Envió una consulta',
};
