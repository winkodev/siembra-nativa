import { createClient } from './server';

export interface AppConfig {
  stock_minimo_visible:     number;
  max_gramos_pedido:        number;
  comprobante_obligatorio:  boolean;
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
  };
}
