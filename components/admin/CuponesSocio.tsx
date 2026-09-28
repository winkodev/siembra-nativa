'use client';

import { useEffect, useState } from 'react';
import { Gift, Loader2, Plus, X, Ban, Check } from 'lucide-react';
import { crearCupon, anularCupon, listarCuponesSocio } from '@/app/actions/cupones';
import { createClient } from '@/lib/supabase/client';
import { labelCupon } from '@/lib/utils/cupones';
import { cn, formatFecha } from '@/lib/utils';
import type { CuponConProducto, TipoCupon } from '@/lib/types/database';

const TIPO_LABEL: Record<TipoCupon, string> = {
  porcentaje:      'Porcentaje de descuento',
  monto:           'Monto fijo de descuento',
  producto_gratis: 'Producto gratis',
  envio_gratis:    'Envío gratis',
};

const ESTADO_BADGE: Record<string, string> = {
  disponible: 'text-club-dorado bg-club-dorado/10 border-club-dorado/30',
  usado:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  anulado:    'text-muted-foreground bg-white/5 border-white/10',
};

interface ProductoOpcion { id: string; nombre: string }

// Sección "Cupones" del drawer del socio (Admin → Socios):
// alta de cupón personal con mensaje libre, listado y anulación.
export function CuponesSocio({ socioId, socioNombre }: { socioId: string; socioNombre: string }) {
  const [cupones, setCupones]   = useState<CuponConProducto[] | null>(null);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [abierto, setAbierto]   = useState(false);
  const [pending, setPending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Formulario
  const [tipo, setTipo]           = useState<TipoCupon>('porcentaje');
  const [valor, setValor]         = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad]   = useState('1');
  const [vence, setVence]         = useState('');
  const [mensaje, setMensaje]     = useState(`¡Gracias ${socioNombre.split(' ')[0]} por este tiempo con nosotros! Que lo disfrutes.`);

  useEffect(() => {
    listarCuponesSocio(socioId).then(res => setCupones(res.ok ? res.data : []));
    createClient().from('productos').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProductos((data as ProductoOpcion[]) ?? []));
  }, [socioId]);

  async function handleCrear() {
    setPending(true);
    setError(null);
    const res = await crearCupon({
      socio_id: socioId,
      tipo,
      valor: tipo === 'porcentaje' || tipo === 'monto' ? parseFloat(valor) : null,
      producto_id: tipo === 'producto_gratis' ? productoId : null,
      cantidad: tipo === 'producto_gratis' ? parseInt(cantidad) || 1 : null,
      mensaje,
      vence_at: vence || null,
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setCupones(prev => [res.data, ...(prev ?? [])]);
    setAbierto(false);
    setValor('');
  }

  async function handleAnular(id: string) {
    setPending(true);
    const res = await anularCupon(id);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setCupones(prev => (prev ?? []).map(c => c.id === id ? { ...c, estado: 'anulado' } : c));
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Cupones
        </p>
        <button
          onClick={() => setAbierto(v => !v)}
          className="flex items-center gap-1 text-xs text-club-dorado hover:text-club-dorado/80 transition-colors"
        >
          {abierto ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Nuevo cupón</>}
        </button>
      </div>

      {error && (
        <p className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>
      )}

      {/* Alta */}
      {abierto && (
        <div className="rounded-xl bg-club-dorado/5 border border-club-dorado/20 p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Beneficio</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoCupon)}
              className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer py-2 text-sm">
              {(Object.keys(TIPO_LABEL) as TipoCupon[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
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

          <p className="text-muted-foreground text-[11px]">
            El socio lo ve al entrar y lo aplica desde el carrito. Un cupón por pedido, y el pedido tiene que llevar flores.
          </p>

          <div className="flex justify-end">
            <button onClick={handleCrear} disabled={pending} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Crear cupón
            </button>
          </div>
        </div>
      )}

      {/* Listado */}
      {cupones === null ? (
        <p className="text-xs text-muted-foreground italic">Cargando…</p>
      ) : cupones.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin cupones.</p>
      ) : (
        <div className="space-y-2">
          {cupones.map(c => (
            <div key={c.id} className="rounded-xl bg-white/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{labelCupon(c)}</p>
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] border', ESTADO_BADGE[c.estado])}>
                  {c.estado === 'disponible' ? 'Disponible' : c.estado === 'usado' ? 'Usado' : 'Anulado'}
                </span>
              </div>
              <p className="text-muted-foreground text-xs whitespace-pre-wrap">{c.mensaje}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Creado {formatFecha(c.created_at)}
                  {c.vence_at && <> · vence {formatFecha(c.vence_at)}</>}
                  {c.usado_at && <> · usado {formatFecha(c.usado_at)}</>}
                  {c.visto_at && c.estado === 'disponible' && <> · <Check className="w-3 h-3 inline" /> visto</>}
                </span>
                {c.estado === 'disponible' && (
                  <button onClick={() => handleAnular(c.id)} disabled={pending}
                    className="flex items-center gap-1 text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50">
                    <Ban className="w-3 h-3" /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
