'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Leaf, ShoppingBag, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { cn, labelTipo, labelCalidad, labelCultivo, formatPrecio } from '@/lib/utils';
import type { StockPublico } from '@/lib/types/database';

const tipoBadge: Record<string, string> = {
  indica:  'bg-purple-900/80 text-purple-200 border border-purple-400/40',
  sativa:  'bg-amber-900/80 text-amber-200 border border-amber-400/40',
  hibrida: 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/40',
};

interface Props {
  genetica:          StockPublico;
  puedeHacerPedidos: boolean;
}

export function DetalleGeneticaClient({ genetica, puedeHacerPedidos }: Props) {
  const { agregar, items, tieneItem } = useCarrito();
  const ref            = { tipo_item: 'genetica' as const, id: genetica.genetica_id };
  const enCarrito      = tieneItem(ref);
  const itemEnCarrito  = items.find(i => i.tipo_item === 'genetica' && i.id === genetica.genetica_id);
  const gramosPedidos  = itemEnCarrito && itemEnCarrito.tipo_item === 'genetica' ? itemEnCarrito.cantidad_gramos : 0;

  const [cantidad, setCantidad]   = useState(10);
  const [feedback, setFeedback]   = useState<number | null>(null); // gramos del último agregado

  const handleAgregar = () => {
    agregar({
      tipo_item:        'genetica',
      id:               genetica.genetica_id,
      nombre:           genetica.nombre,
      tipo:             genetica.tipo,
      cantidad_gramos:  cantidad,
      stock_disponible: genetica.stock_total_gramos,
      precio_gramo:     genetica.precio_gramo,
    });
    setFeedback(cantidad);
    setTimeout(() => setFeedback(null), 1400);
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
          {genetica.imagen_url ? (
            <Image src={genetica.imagen_url} alt={genetica.nombre} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
              <Leaf className="w-24 h-24" />
            </div>
          )}
          <span className={cn('absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-medium', tipoBadge[genetica.tipo])}>
            {labelTipo(genetica.tipo)}
          </span>

          {/* Píldora "en tu pedido" superpuesta en la imagen */}
          <AnimatePresence>
            {enCarrito && feedback === null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-club-dorado/90 text-club-verde text-xs font-bold backdrop-blur-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {gramosPedidos}g en pedido
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h1 className="font-avigea text-4xl text-foreground mb-3">{genetica.nombre}</h1>
            <div className="flex flex-wrap gap-4">
              {genetica.thc != null && (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-club-dorado font-bold text-xl">{genetica.thc}%</p>
                  <p className="text-muted-foreground text-xs">THC</p>
                </div>
              )}
              {genetica.cbd != null && (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-club-dorado font-bold text-xl">{genetica.cbd}%</p>
                  <p className="text-muted-foreground text-xs">CBD</p>
                </div>
              )}
              {genetica.precio_gramo != null && (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-club-dorado font-bold text-xl">{formatPrecio(genetica.precio_gramo)}</p>
                  <p className="text-muted-foreground text-xs">por gramo</p>
                </div>
              )}
              {genetica.calidad && (
                <div className="glass-card px-4 py-2 text-center">
                  <p className={cn('font-bold text-xl', genetica.calidad === 'premium' ? 'text-club-dorado' : 'text-foreground/80')}>
                    {labelCalidad(genetica.calidad)}
                  </p>
                  <p className="text-muted-foreground text-xs">Calidad</p>
                </div>
              )}
              {genetica.cultivo && (
                <div className="glass-card px-4 py-2 text-center">
                  <p className="text-foreground/80 font-bold text-xl">{labelCultivo(genetica.cultivo)}</p>
                  <p className="text-muted-foreground text-xs">Cultivo</p>
                </div>
              )}
              <div className="glass-card px-4 py-2 text-center">
                <p className="text-emerald-400 font-bold text-xl">✓</p>
                <p className="text-muted-foreground text-xs">Disponible</p>
              </div>
            </div>
          </div>

          {genetica.descripcion && (
            <p className="text-muted-foreground leading-relaxed">{genetica.descripcion}</p>
          )}

          {!puedeHacerPedidos && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Tu documentación aún no fue aprobada. Una vez que el club la revise, vas a poder hacer pedidos.</p>
            </div>
          )}

          {/* Selector + botón agregar */}
          {puedeHacerPedidos && (
            <div className="space-y-4 pt-2">
              {/* Selector de gramos */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Elegí la cantidad</p>
                <div className="flex gap-2">
                  {[10, 20, 30, 40].map(g => (
                    <button
                      key={g}
                      onClick={() => setCantidad(g)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                        cantidad === g
                          ? 'bg-club-dorado text-club-verde border-club-dorado shadow-dorado-sm'
                          : 'bg-club-verde-claro/15 text-muted-foreground border-white/10 hover:border-club-dorado/40 hover:text-foreground'
                      )}
                    >
                      {g}g
                    </button>
                  ))}
                </div>
                {genetica.precio_gramo != null && (
                  <p className="text-center text-sm text-muted-foreground">
                    {cantidad}g = <span className="text-club-dorado font-bold">{formatPrecio(cantidad * genetica.precio_gramo)}</span>
                  </p>
                )}
              </div>

              {/* Botón agregar — siempre acumula */}
              <motion.button
                onClick={handleAgregar}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200',
                  feedback !== null
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'btn-primary'
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {feedback !== null ? (
                    <motion.span
                      key="ok"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      +{feedback}g agregados al pedido
                    </motion.span>
                  ) : (
                    <motion.span
                      key="add"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar {cantidad}g al pedido
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Info acumulado actual */}
              <AnimatePresence>
                {enCarrito && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-center text-xs text-muted-foreground"
                  >
                    Total en pedido:{' '}
                    <span className="text-club-dorado font-semibold">{gramosPedidos}g</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
