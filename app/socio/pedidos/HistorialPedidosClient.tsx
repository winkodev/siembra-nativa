'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, ChevronDown, Clock, Receipt, Loader2, CheckCircle2 } from 'lucide-react';
import { cn, formatFecha, formatGramos, formatNumeroPedido, labelTipo, labelCategoriaProducto, badgePedido } from '@/lib/utils';
import { subirComprobante } from '@/app/actions/pedidos';
import type { PedidoConItems, EstadoPedido } from '@/lib/types/database';

const labelEstado: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Presentación de un item, sea genética (gramos) o producto (unidades)
function itemDisplay(item: PedidoConItems['pedido_items'][number]) {
  if (item.geneticas) {
    return {
      nombre:   item.geneticas.nombre,
      sub:      labelTipo(item.geneticas.tipo),
      cantidad: formatGramos(item.cantidad_gramos ?? 0),
    };
  }
  return {
    nombre:   item.productos?.nombre ?? 'Producto',
    sub:      labelCategoriaProducto(item.productos?.categoria ?? 'otro'),
    cantidad: `${item.cantidad_unidades ?? 0} u.`,
  };
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function HistorialPedidosClient({
  pedidos: iniciales,
  direccionEntrega,
}: {
  pedidos: PedidoConItems[];
  direccionEntrega: string | null;
}) {
  // Todos los pedidos arrancan colapsados — el usuario expande el que quiera
  const [pedidos, setPedidos]     = useState(iniciales);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const handleSubirComprobante = (pedidoId: string, file: File | undefined) => {
    if (!file) return;
    setSubiendoId(pedidoId);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('pedido_id', pedidoId);
      fd.append('comprobante', file);
      const res = await subirComprobante(fd);
      setSubiendoId(null);
      if (!res.ok) { setError(res.error); return; }
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, ...res.data } : p));
    });
  };

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Todavía no hiciste ningún pedido.</p>
        <Link href="/socio/tienda" className="btn-primary text-sm px-6 py-2.5">
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 max-w-2xl mx-auto">

      <motion.div variants={fadeUp}>
        <h1 className="font-avigea text-3xl text-foreground flex items-center gap-3">
          <ShoppingBag className="w-7 h-7 text-club-dorado" />
          Mis pedidos
        </h1>
        <div className="divider-dorado mt-2" />
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      {pedidos.map(pedido => {
        const abierto = expandido === pedido.id;
        const totalGramos = pedido.pedido_items.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);

        return (
          <motion.div key={pedido.id} variants={fadeUp} className="glass-card overflow-hidden">
            {/* Cabecera del pedido */}
            <button
              onClick={() => setExpandido(abierto ? null : pedido.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-club-verde-claro/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-club-dorado text-xs font-bold">{formatNumeroPedido(pedido.numero)}</span>
                    <span className="text-foreground font-semibold text-sm">
                      {formatFecha(pedido.created_at)}
                    </span>
                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold', badgePedido(pedido.estado))}>
                      {labelEstado[pedido.estado]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{pedido.pedido_items.length} {pedido.pedido_items.length === 1 ? 'ítem' : 'ítems'}</span>
                    {totalGramos > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-club-dorado font-medium">{formatGramos(totalGramos)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', abierto && 'rotate-180')} />
            </button>

            {/* Detalle expandible */}
            <AnimatePresence initial={false}>
              {abierto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-club-verde-claro/20">
                    {/* Items */}
                    <div className="divide-y divide-club-verde-claro/10">
                      {pedido.pedido_items.map(item => {
                        const d = itemDisplay(item);
                        return (
                          <div key={item.id} className="flex items-center justify-between px-5 py-3">
                            <div>
                              <p className="text-foreground text-sm font-medium">{d.nombre}</p>
                              <p className="text-muted-foreground text-xs">{d.sub}</p>
                            </div>
                            <span className="text-club-dorado font-bold text-sm">{d.cantidad}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Notas y footer */}
                    <div className="px-5 py-4 bg-club-dorado/5 space-y-2">
                      {direccionEntrega && (
                        <p className="text-muted-foreground text-xs">
                          <span className="text-foreground/70 font-medium">Dirección: </span>
                          {direccionEntrega}
                        </p>
                      )}
                      {pedido.entrega_franja && (
                        <p className="text-muted-foreground text-xs">
                          <span className="text-foreground/70 font-medium">Entrega: </span>
                          {pedido.entrega_franja}
                        </p>
                      )}
                      {pedido.notas && (
                        <p className="text-muted-foreground text-xs">
                          <span className="text-foreground/70 font-medium">Nota: </span>
                          {pedido.notas}
                        </p>
                      )}
                      {totalGramos > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Total de flores</span>
                          <span className="text-club-dorado font-bold">{formatGramos(totalGramos)}</span>
                        </div>
                      )}

                      {/* Comprobante de pago (solo pedidos activos) */}
                      {(pedido.estado === 'pendiente' || pedido.estado === 'aprobado' || pedido.comprobante_path) && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-club-verde-claro/15">
                          {pedido.comprobante_path ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Comprobante cargado
                              {pedido.comprobante_subido_at && ` el ${formatFecha(pedido.comprobante_subido_at)}`}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Receipt className="w-3.5 h-3.5" />
                              Sin comprobante de pago
                            </span>
                          )}

                          {(pedido.estado === 'pendiente' || pedido.estado === 'aprobado') && (
                            <label className={cn(
                              'shrink-0 px-3 py-1.5 rounded-xl border border-club-dorado/30 text-club-dorado text-xs font-medium cursor-pointer hover:bg-club-dorado/10 transition-all flex items-center gap-1.5',
                              pending && subiendoId === pedido.id && 'opacity-50 pointer-events-none'
                            )}>
                              {pending && subiendoId === pedido.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Receipt className="w-3.5 h-3.5" />}
                              {pedido.comprobante_path ? 'Reemplazar' : 'Subir comprobante'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="sr-only"
                                onChange={e => { handleSubirComprobante(pedido.id, e.target.files?.[0]); e.target.value = ''; }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

    </motion.div>
  );
}
