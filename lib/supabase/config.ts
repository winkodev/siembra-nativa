import { createClient } from './server';

export interface AppConfig {
  stock_minimo_visible:     number;
  max_gramos_pedido:        number;
  comprobante_obligatorio:  boolean;
  costo_envio:              number;  // 0 = no se cobra
  envio_gratis_desde:       number;  // gramos; 0 = se cobra siempre
  reprocann_aviso_dias:     number;  // anticipación del aviso de vencimiento
  descuento_20:             number;  // % sobre flores al pedir 20g o más
  descuento_40:             number;  // % sobre flores al pedir 40g o más
  // Datos para transferir (los carga el superadmin; vacíos = no se muestran al socio)
  pago_alias:               string;
  pago_cbu:                 string;
  pago_titular:             string;
  pago_banco:               string;
  pago_instrucciones:       string;
  // Paso "Sumá productos" al cerrar el carrito
  upsell_titulo:            string;
  upsell_texto:             string;
  // Horas mínimas entre el pedido y la franja de entrega elegible
  entrega_anticipacion_horas: number;
  // Avisos por email a los admins (Configuración → Avisos)
  avisos_emails:            string;   // direcciones separadas por coma
  avisos_nuevo_pedido:      boolean;
  avisos_comprobante:       boolean;
  avisos_certificado:       boolean;
  avisos_consulta:          boolean;
}

export async function getAppConfig(): Promise<AppConfig> {
  const supabase = createClient();
  const { data } = await supabase.from('configuracion_app').select('clave, valor');

  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.clave] = row.valor;

  return {
    stock_minimo_visible:    parseInt(map['stock_minimo_visible'] ?? '100'),
    max_gramos_pedido:       parseInt(map['max_gramos_pedido'] ?? '40'),
    comprobante_obligatorio: map['comprobante_obligatorio'] === 'true',
    costo_envio:             parseFloat(map['costo_envio'] ?? '0') || 0,
    envio_gratis_desde:      parseFloat(map['envio_gratis_desde'] ?? '0') || 0,
    reprocann_aviso_dias:    parseInt(map['reprocann_aviso_dias'] ?? '30') || 30,
    descuento_20:            parseFloat(map['descuento_20'] ?? '0') || 0,
    descuento_40:            parseFloat(map['descuento_40'] ?? '0') || 0,
    pago_alias:              map['pago_alias'] ?? '',
    pago_cbu:                map['pago_cbu'] ?? '',
    pago_titular:            map['pago_titular'] ?? '',
    pago_banco:              map['pago_banco'] ?? '',
    pago_instrucciones:      map['pago_instrucciones'] ?? '',
    upsell_titulo:           map['upsell_titulo'] ?? 'Sumá productos a tu pedido',
    upsell_texto:            map['upsell_texto'] ?? 'Aprovechá el envío y agregá alguno de estos productos.',
    entrega_anticipacion_horas: parseFloat(map['entrega_anticipacion_horas'] ?? '48') || 48,
    avisos_emails:           map['avisos_emails'] ?? '',
    avisos_nuevo_pedido:     map['avisos_nuevo_pedido'] === 'true',
    avisos_comprobante:      map['avisos_comprobante'] === 'true',
    avisos_certificado:      map['avisos_certificado'] === 'true',
    avisos_consulta:         map['avisos_consulta'] === 'true',
  };
}

// Claves de datos de pago (alias / CBU). Un 'use server' no puede exportar
// constantes, por eso viven acá y no en la action.
export const CLAVES_PAGO = ['pago_alias', 'pago_cbu', 'pago_titular', 'pago_banco', 'pago_instrucciones'] as const;
export type DatosPago = Record<(typeof CLAVES_PAGO)[number], string>;
