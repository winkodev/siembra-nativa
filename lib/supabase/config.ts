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
  };
}

// Claves de datos de pago (alias / CBU). Un 'use server' no puede exportar
// constantes, por eso viven acá y no en la action.
export const CLAVES_PAGO = ['pago_alias', 'pago_cbu', 'pago_titular', 'pago_banco', 'pago_instrucciones'] as const;
export type DatosPago = Record<(typeof CLAVES_PAGO)[number], string>;
