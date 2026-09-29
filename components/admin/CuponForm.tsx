'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TipoCupon } from '@/lib/types/database';

export const TIPO_CUPON_LABEL: Record<TipoCupon, string> = {
  porcentaje:      'Porcentaje de descuento',
  monto:           'Monto fijo de descuento',
  producto_gratis: 'Producto gratis',
  envio_gratis:    'Envío gratis',
};

// Lo que el formulario devuelve al padre (sin socio: lo pone quien lo usa)
export interface DatosCuponForm {
  tipo:        TipoCupon;
  valor:       number | null;
  producto_id: string | null;
  cantidad:    number | null;
  mensaje:     string;
  vence_at:    string | null;
}

interface ProductoOpcion { id: string; nombre: string }

interface Props {
  mensajeInicial: string;
  onChange:       (datos: DatosCuponForm) => void;
}

// Campos de un cupón (beneficio, valor, producto, mensaje, vencimiento).
// Lo usan el alta individual (ficha del socio) y el alta masiva.
export function CuponForm({ mensajeInicial, onChange }: Props) {
  const [productos, setProductos]   = useState<ProductoOpcion[]>([]);
  const [tipo, setTipo]             = useState<TipoCupon>('porcentaje');
  const [valor, setValor]           = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad]     = useState('1');
  const [vence, setVence]           = useState('');
  const [mensaje, setMensaje]       = useState(mensajeInicial);

  useEffect(() => {
    createClient().from('productos').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProductos((data as ProductoOpcion[]) ?? []));
  }, []);

  // Cada cambio se informa al padre ya normalizado
  useEffect(() => {
    onChange({
      tipo,
      valor:       tipo === 'porcentaje' || tipo === 'monto' ? parseFloat(valor) || null : null,
      producto_id: tipo === 'producto_gratis' ? productoId || null : null,
      cantidad:    tipo === 'producto_gratis' ? parseInt(cantidad) || 1 : null,
      mensaje,
      vence_at:    vence || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, valor, productoId, cantidad, vence, mensaje]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-foreground/80 font-medium">Beneficio</label>
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoCupon)}
          className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer py-2 text-sm">
          {(Object.keys(TIPO_CUPON_LABEL) as TipoCupon[]).map(t => <option key={t} value={t}>{TIPO_CUPON_LABEL[t]}</option>)}
        </select>
      </div>

      {(tipo === 'porcentaje' || tipo === 'monto') && (
        <div className="space-y-1.5">
          <label className="text-xs text-foreground/80 font-medium">{tipo === 'porcentaje' ? 'Porcentaje (1 a 100)' : 'Monto en $'}</label>
          <input type="number" min="1" max={tipo === 'porcentaje' ? 100 : undefined} value={valor}
            onChange={e => setValor(e.target.value)} className="input-club w-full py-2 text-sm"
            placeholder={tipo === 'porcentaje' ? '15' : '5000'} />
        </div>
      )}

      {tipo === 'producto_gratis' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Producto</label>
            <select value={productoId} onChange={e => setProductoId(e.target.value)}
              className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer py-2 text-sm">
              <option value="">Elegí un producto</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Unidades</label>
            <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
              className="input-club w-full py-2 text-sm" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-foreground/80 font-medium">Mensaje para el socio</label>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={3}
          className="input-club w-full resize-none text-sm" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-foreground/80 font-medium">Vence (opcional)</label>
        <input type="date" value={vence} onChange={e => setVence(e.target.value)} className="input-club w-full py-2 text-sm" />
      </div>
    </div>
  );
}
