'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, ShoppingBag, AlertTriangle, CheckCircle2, Plus, Minus } from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { cn, labelCategoriaProducto } from '@/lib/utils';
import type { Producto } from '@/lib/types/database';

const categoriaBadge: Record<string, string> = {
  aceite:        'bg-amber-900/80 text-amber-200 border border-amber-400/40',
  merchandising: 'bg-blue-900/80 text-blue-200 border border-blue-400/40',
  otro:          'bg-gray-800/80 text-gray-300 border border-gray-500/40',
};

interface Props {
  producto:          Producto;
  puedeHacerPedidos: boolean;
}

export function DetalleProductoClient({ producto, puedeHacerPedidos }: Props) {
  const { agregar, items, tieneItem } = useCarrito();
  const ref           = { tipo_item: 'producto' as const, id: producto.id };
  const enCarrito     = tieneItem(ref);
  const itemEnCarrito = items.find(i => i.tipo_item === 'producto' && i.id === producto.id);
  const unidadesPedidas = itemEnCarrito && itemEnCarrito.tipo_item === 'producto' ? itemEnCarrito.cantidad_unidades : 0;

  const sinStock = producto.stock === 0;
  const [cantidad, setCantidad] = useState(1);
  const [feedback, setFeedback] = useState(false);

  const handleAgregar = () => {
    agregar({
      tipo_item:         'producto',
      id:                producto.id,
      nombre:            producto.nombre,
      categoria:         producto.categoria,
      precio:            producto.precio,
      cantidad_unidades: cantidad,
      stock_disponible:  producto.stock,
    });
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <Link href="/socio/tienda" className="inline-flex items-center gap-2 text-muted-foreground hover:text-club-dorado transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a la tienda
      </Link>

      <div className="glass-card overflow-hidden">
        {/* Imagen */}
        <div className="relative h-64 sm:h-80 bg-club-verde-claro/20">
          {producto.imagen_url ? (
            <Image src={producto.imagen_url} alt={producto.nombre} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
              <Package className="w-24 h-24" />
            </div>
          )}
          <span className={cn('absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-medium', categoriaBadge[producto.categoria])}>
            {labelCategoriaProducto(producto.categoria)}
          </span>

          <AnimatePresence>
            {enCarrito && !feedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-club-dorado/90 text-club-verde text-xs font-bold backdrop-blur-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {unidadesPedidas} en pedido
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h1 className="font-avigea text-4xl text-foreground mb-3">{producto.nombre}</h1>
            <div className="flex flex-wrap gap-4 items-center">
              {producto.precio != null ? (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-club-dorado font-bold text-xl">${producto.precio.toFixed(2)}</p>
                  <p className="text-muted-foreground text-xs">Precio</p>
                </div>
              ) : (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-foreground font-medium text-sm">Consultar</p>
                  <p className="text-muted-foreground text-xs">Precio</p>
                </div>
              )}
              <div className="glass-card px-4 py-2 text-center">
                <p className={cn('font-bold text-xl', sinStock ? 'text-red-400' : 'text-emerald-400')}>
                  {sinStock ? '0' : producto.stock}
                </p>
                <p className="text-muted-foreground text-xs">{sinStock ? 'Sin stock' : 'Disponibles'}</p>
              </div>
            </div>
          </div>

          {producto.descripcion && (
            <p className="text-muted-foreground leading-relaxed">{producto.descripcion}</p>
          )}

          {!puedeHacerPedidos && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Tu documentación aún no fue aprobada. Una vez que el club la revise, vas a poder hacer pedidos.</p>
            </div>
          )}

          {/* Selector de unidades + agregar */}
          {puedeHacerPedidos && !sinStock && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cantidad</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCantidad(c => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    className="p-2.5 rounded-xl border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-bold text-foreground">{cantidad}</span>
                  <button
                    onClick={() => setCantidad(c => Math.min(producto.stock, c + 1))}
                    disabled={cantidad >= producto.stock}
                    className="p-2.5 rounded-xl border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <motion.button
                onClick={handleAgregar}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200',
                  feedback
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'btn-primary'
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {feedback ? (
                    <motion.span key="ok" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Agregado al pedido
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Agregar {cantidad} al pedido
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <AnimatePresence>
                {enCarrito && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-center text-xs text-muted-foreground"
                  >
                    En pedido: <span className="text-club-dorado font-semibold">{unidadesPedidas} u.</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {sinStock && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-500/10 border border-gray-500/25 text-muted-foreground text-sm">
              <Package className="w-4 h-4 shrink-0" />
              Este producto no tiene stock disponible por el momento.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
