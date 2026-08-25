'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, X, Trash2, ArrowRight, AlertTriangle, Minus, Plus, Gift, BadgePercent } from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { cn, labelTipo, labelCategoriaProducto, formatPrecio } from '@/lib/utils';

const GRAMOS = [10, 20, 30, 40];

export function CarritoDrawer() {
  const { items, totalItems, totalGramos, quitar, actualizar, vaciar, abierto, setAbierto, maxGramos, descuento20, descuento40, costoEnvio, envioGratisDesde, contadorAgregados } = useCarrito();
  const total    = totalGramos; // el límite por pedido aplica solo a las flores
  const excede   = total > maxGramos;
  const porciento = Math.min((total / maxGramos) * 100, 100);

  // Subtotales en $ (items con precio cargado; el envío se calcula al confirmar)
  const subtotalFlores = items.reduce((acc, i) =>
    acc + (i.tipo_item === 'genetica' ? (i.precio_gramo ?? 0) * i.cantidad_gramos : 0), 0);
  const subtotalProd = items.reduce((acc, i) =>
    acc + (i.tipo_item === 'producto' ? (i.precio ?? 0) * i.cantidad_unidades : 0), 0);

  // Descuento por cantidad sobre las flores (gana el umbral mayor)
  const descPct   = totalGramos >= 40 ? descuento40 : totalGramos >= 20 ? descuento20 : 0;
  const descMonto = Math.round(subtotalFlores * descPct) / 100;
  const totalMonto = subtotalFlores - descMonto + subtotalProd;

  // Nudge: empuja al próximo umbral de descuento alcanzable. El ahorro se
  // proyecta sobre el subtotal QUE TENDRÍA al llegar al umbral (los gramos
  // agregados también se bonifican), estimando su precio con el promedio
  // por gramo de las flores ya elegidas — por eso se muestra como "aprox.".
  const gramosConPrecio = items.reduce((acc, i) =>
    acc + (i.tipo_item === 'genetica' && i.precio_gramo != null ? i.cantidad_gramos : 0), 0);
  const precioPromGramo = gramosConPrecio > 0 ? subtotalFlores / gramosConPrecio : 0;

  // ¿El envío pasa a bonificado al llegar al umbral? (y todavía no lo está)
  const envioSeBonifica = (umbral: number) =>
    costoEnvio > 0 && envioGratisDesde > 0 && umbral >= envioGratisDesde && totalGramos < envioGratisDesde;

  const nudge = (() => {
    if (excede || subtotalFlores <= 0) return null;
    if (totalGramos < 20 && descuento20 > 0 && maxGramos >= 20) {
      const faltan = 20 - totalGramos;
      const subtotalProyectado = subtotalFlores + faltan * precioPromGramo;
      const conEnvio = envioSeBonifica(20);
      return {
        faltan,
        pct:      descuento20,
        ahorro:   Math.round(subtotalProyectado * descuento20) / 100 + (conEnvio ? costoEnvio : 0),
        aplicado: 0,
        conEnvio,
      };
    }
    if (totalGramos >= 20 && totalGramos < 40 && descuento40 > descuento20 && maxGramos >= 40) {
      const faltan = 40 - totalGramos;
      const subtotalProyectado = subtotalFlores + faltan * precioPromGramo;
      const conEnvio = envioSeBonifica(40);
      // Extra = bonificación proyectada al 40 menos la ya aplicada, más el envío si se libera
      return {
        faltan,
        pct:      descuento40,
        ahorro:   Math.round(subtotalProyectado * descuento40 - subtotalFlores * descPct) / 100 + (conEnvio ? costoEnvio : 0),
        aplicado: descPct,
        conEnvio,
      };
    }
    return null;
  })();

  /* Animación squeezy del ícono cuando se agrega algo */
  const iconControls = useAnimation();
  useEffect(() => {
    if (contadorAgregados === 0) return;
    iconControls.start({
      scale:    [1, 1.35, 0.75, 1.2, 0.9, 1.05, 1],
      rotate:   [0, -8, 8, -4, 4, 0],
      transition: { duration: 0.55, times: [0, 0.15, 0.35, 0.5, 0.65, 0.82, 1] },
    });
  }, [contadorAgregados, iconControls]);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(true)}
        className={cn(
          'relative p-2.5 rounded-xl glass-card transition-colors',
          excede
            ? 'text-red-400 border-red-500/40 animate-pulse'
            : totalItems > 0
            ? 'text-club-dorado border-club-dorado/40 shadow-dorado-sm hover:text-club-dorado-claro'
            : 'text-foreground hover:text-club-dorado'
        )}
        aria-label="Ver carrito"
      >
        {/* Latido continuo mientras el pedido tenga items (doble pulso tipo corazón) */}
        <motion.div
          animate={totalItems > 0 && !excede
            ? { scale: [1, 1.18, 1, 1.12, 1] }
            : { scale: 1 }}
          transition={totalItems > 0 && !excede
            ? { duration: 1.1, times: [0, 0.2, 0.45, 0.65, 1], repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }
            : { duration: 0.2 }}
        >
          <motion.div animate={iconControls}>
            <ShoppingBag className="w-5 h-5" />
          </motion.div>
        </motion.div>
        {totalItems > 0 && (
          <motion.span
            key={totalItems}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center',
              excede ? 'bg-red-500 text-white' : 'bg-club-dorado text-club-verde'
            )}
          >
            {totalItems}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAbierto(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal centrado */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed z-50 inset-x-4 top-[10vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md"
            >
              <div className="bg-club-verde border border-club-verde-claro/30 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-club-verde-claro/30">
                  <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-club-dorado" />
                    Mi pedido
                  </h2>
                  <button
                    onClick={() => setAbierto(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Items */}
                <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                      <p className="text-muted-foreground text-sm">Tu pedido está vacío.</p>
                    </div>
                  ) : (
                    items.map(item => (
                      <div key={`${item.tipo_item}:${item.id}`} className="bg-club-verde-claro/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <div>
                            <p className="text-foreground font-semibold text-sm">{item.nombre}</p>
                            <p className="text-muted-foreground text-xs">
                              {item.tipo_item === 'genetica'
                                ? labelTipo(item.tipo)
                                : labelCategoriaProducto(item.categoria)}
                            </p>
                          </div>
                          <button
                            onClick={() => quitar(item)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {item.tipo_item === 'genetica' ? (
                          <>
                            {/* Selector de gramos — ajusta la cantidad de la flor */}
                            <div className="flex gap-1.5">
                              {GRAMOS.map(g => (
                                <button
                                  key={g}
                                  onClick={() => actualizar(item, g)}
                                  className={cn(
                                    'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                    item.cantidad_gramos === g
                                      ? 'bg-club-dorado text-club-verde border-club-dorado'
                                      : 'bg-transparent text-muted-foreground border-club-verde-claro/40 hover:border-club-dorado/50 hover:text-foreground'
                                  )}
                                >
                                  {g}g
                                </button>
                              ))}
                            </div>
                            {/* Total acumulado si no coincide con ninguna opción fija */}
                            {!GRAMOS.includes(item.cantidad_gramos) && (
                              <p className="text-xs text-club-dorado mt-1.5 text-center font-semibold">
                                {item.cantidad_gramos}g en pedido
                              </p>
                            )}
                            {item.precio_gramo != null && (
                              <p className="text-right text-club-dorado font-bold text-sm mt-2">
                                {formatPrecio(item.precio_gramo * item.cantidad_gramos)}
                              </p>
                            )}
                          </>
                        ) : (
                          /* Stepper de unidades para productos */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => actualizar(item, item.cantidad_unidades - 1)}
                                disabled={item.cantidad_unidades <= 1}
                                className="p-1.5 rounded-lg border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-10 text-center text-sm font-bold text-foreground">{item.cantidad_unidades}</span>
                              <button
                                onClick={() => actualizar(item, item.cantidad_unidades + 1)}
                                disabled={item.cantidad_unidades >= item.stock_disponible}
                                className="p-1.5 rounded-lg border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {item.precio != null && (
                              <span className="text-club-dorado font-bold text-sm">
                                {formatPrecio(item.precio * item.cantidad_unidades)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                  <div className="px-5 py-4 border-t border-club-verde-claro/30 space-y-3">
                    {/* Nudge hacia el próximo descuento por cantidad */}
                    {nudge && (
                      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs leading-relaxed">
                        {nudge.aplicado > 0
                          ? <BadgePercent className="w-4 h-4 shrink-0 mt-0.5" />
                          : <Gift className="w-4 h-4 shrink-0 mt-0.5" />}
                        <p>
                          {nudge.aplicado > 0 ? (
                            <>
                              ¡Ya tenés <span className="font-bold">{nudge.aplicado}% off</span> aplicado!
                              Con <span className="font-bold">{nudge.faltan}g más</span> de flores pasás
                              al {nudge.pct}%{nudge.conEnvio && <> y el <span className="font-bold">envío va bonificado</span></>} —
                              ahorrarías <span className="font-bold">{formatPrecio(nudge.ahorro)}</span> extra.
                            </>
                          ) : (
                            <>
                              Sumá <span className="font-bold">{nudge.faltan}g más</span> de flores y
                              llevate <span className="font-bold">{nudge.pct}% off</span>
                              {nudge.conEnvio && <> con el <span className="font-bold">envío bonificado</span></>} —
                              ahorrarías <span className="font-bold">{formatPrecio(nudge.ahorro)}</span>.
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Total estimado con descuento por cantidad */}
                    {totalMonto > 0 && (
                      <div className="space-y-1">
                        {descMonto > 0 && (
                          <>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>Subtotal</span>
                              <span className="line-through">{formatPrecio(subtotalFlores + subtotalProd)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-emerald-400 font-semibold">
                                Bonificación {descPct}% ({totalGramos >= 40 ? '40g' : '20g'} o más)
                              </span>
                              <span className="text-emerald-400 font-semibold">−{formatPrecio(descMonto)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Total estimado <span className="text-xs">(sin envío)</span></span>
                          <span className="text-club-dorado font-bold text-base">{formatPrecio(totalMonto)}</span>
                        </div>
                      </div>
                    )}

                    {/* Barra de límite */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Flores en el pedido</span>
                        <span className={cn('font-bold', excede ? 'text-red-400' : 'text-foreground')}>
                          {total}g / {maxGramos}g
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-club-verde-claro/30 overflow-hidden">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            excede ? 'bg-red-400' : 'bg-club-dorado'
                          )}
                          animate={{ width: `${porciento}%` }}
                          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        />
                      </div>
                    </div>

                    {excede ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        El máximo por pedido es {maxGramos}g. Reducí alguna cantidad.
                      </div>
                    ) : (
                      <Link
                        href="/socio/pedidos/nuevo"
                        onClick={() => setAbierto(false)}
                        className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                      >
                        Continuar pedido <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}

                    <button
                      onClick={vaciar}
                      className="w-full text-center text-xs text-muted-foreground hover:text-red-400 transition-colors py-1"
                    >
                      Vaciar pedido
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
