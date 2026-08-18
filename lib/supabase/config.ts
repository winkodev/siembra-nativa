import { createClient } from './server';

export interface AppConfig {
  stock_minimo_visible:     number;
  max_gramos_pedido:        number;
  comprobante_obligatorio:  boolean;
  costo_envio:              number;  // 0 = no se cobra
  envio_gratis_desde:       number;  // gramos; 0 = se cobra siempre
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
  };
}
