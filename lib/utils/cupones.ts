import type { CarritoItem, CuponConProducto } from '@/lib/types/database';

// Misma lógica que crear_pedido en la base: el carrito y el checkout la
// usan para MOSTRAR el descuento; el monto definitivo lo calcula la base.
export interface BaseCupon {
  subtotalFlores: number;
  descMonto:      number;   // descuento por cantidad ya calculado
  subtotalProd:   number;
  montoEnvio:     number;   // envío que se cobraría sin cupón
  totalGramos:    number;
  items:          CarritoItem[];
}

// Motivo por el que el cupón todavía no se puede aplicar (null = aplica)
export function motivoCuponNoAplica(cupon: CuponConProducto, base: BaseCupon): string | null {
  if (cupon.vence_at && new Date(cupon.vence_at) < new Date()) return 'El cupón está vencido.';
  if (base.totalGramos <= 0) return 'Agregá flores al pedido para usar el cupón.';
  if (cupon.tipo === 'producto_gratis') {
    const unidades = base.items
      .filter(i => i.tipo_item === 'producto' && i.id === cupon.producto_id)
      .reduce((acc, i) => acc + (i.tipo_item === 'producto' ? i.cantidad_unidades : 0), 0);
    if (unidades < (cupon.cantidad ?? 1)) return 'Agregá el producto de regalo al pedido.';
  }
  return null;
}

// Monto que descuenta el cupón sobre el pedido actual (0 si no aplica)
export function montoCupon(cupon: CuponConProducto, base: BaseCupon): number {
  if (motivoCuponNoAplica(cupon, base)) return 0;
  const baseMonto = base.subtotalFlores - base.descMonto + base.subtotalProd;
  switch (cupon.tipo) {
    case 'porcentaje':      return Math.round(baseMonto * (cupon.valor ?? 0)) / 100;
    case 'monto':           return Math.min(cupon.valor ?? 0, baseMonto);
    case 'envio_gratis':    return base.montoEnvio;
    case 'producto_gratis': return Math.min((cupon.producto?.precio ?? 0) * (cupon.cantidad ?? 1), baseMonto);
  }
}

// Descripción corta del beneficio ("15% de descuento", "1 Aceite gratis"...)
export function labelCupon(cupon: CuponConProducto): string {
  switch (cupon.tipo) {
    case 'porcentaje':      return `${cupon.valor}% de descuento`;
    case 'monto':           return `$${(cupon.valor ?? 0).toLocaleString('es-AR')} de descuento`;
    case 'envio_gratis':    return 'Envío gratis';
    case 'producto_gratis': return `${cupon.cantidad ?? 1} × ${cupon.producto?.nombre ?? 'producto'} gratis`;
  }
}
