'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Gift, X, Sparkles } from 'lucide-react';
import { misCupones, marcarCuponVisto } from '@/app/actions/cupones';
import { labelCupon } from '@/lib/utils/cupones';
import { formatFecha } from '@/lib/utils';
import type { CuponConProducto } from '@/lib/types/database';

// Partículas doradas que salen del regalo al abrir el popup
const PARTICULAS = Array.from({ length: 14 }, (_, i) => ({
  angulo: (i / 14) * Math.PI * 2,
  dist:   70 + (i % 3) * 25,
  delay:  0.25 + (i % 4) * 0.05,
  size:   4 + (i % 3) * 2,
}));

// Popup "Tenés un regalo": aparece una vez por cupón nuevo (visto_at = null)
export function CuponPopup() {
  const [cupon, setCupon] = useState<CuponConProducto | null>(null);

  useEffect(() => {
    misCupones().then(res => {
      if (!res.ok) return;
      const nuevo = res.data.find(c => !c.visto_at);
      if (nuevo) setCupon(nuevo);
    });
  }, []);

  function cerrar() {
    if (!cupon) return;
    marcarCuponVisto(cupon.id);   // no bloquea: si falla, se vuelve a mostrar la próxima vez
    setCupon(null);
  }

  return (
    <AnimatePresence>
      {cupon && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />

          {/* Entrada squishy: pasa de chiquito y aplastado a su tamaño con rebote */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4, scaleX: 1.3, y: 60 }}
            animate={{ opacity: 1, scale: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 13, mass: 0.9 }}
            className="fixed z-[70] inset-x-4 top-[14vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm"
          >
            <div className="relative bg-club-verde border-2 border-club-dorado/60 rounded-3xl shadow-2xl shadow-club-dorado/20 overflow-hidden">
              {/* Brillo de fondo */}
              <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-club-dorado/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-club-dorado/10 blur-3xl pointer-events-none" />

              <button
                onClick={cerrar}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors z-10"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative px-6 pt-8 pb-6 text-center space-y-4">
                {/* Regalo con sacudida + partículas */}
                <div className="relative w-20 h-20 mx-auto">
                  {PARTICULAS.map((p, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: Math.cos(p.angulo) * p.dist,
                        y: Math.sin(p.angulo) * p.dist,
                        scale: [0, 1.2, 0.6],
                      }}
                      transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 rounded-full bg-club-dorado pointer-events-none"
                      style={{ width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
                    />
                  ))}
                  <motion.div
                    initial={{ rotate: 0 }}
                    animate={{ rotate: [0, -14, 12, -8, 6, 0], scale: [1, 1.15, 1] }}
                    transition={{ delay: 0.3, duration: 0.7, ease: 'easeInOut' }}
                    className="w-20 h-20 rounded-2xl bg-club-dorado/15 border border-club-dorado/40 flex items-center justify-center text-club-dorado shadow-dorado-sm"
                  >
                    <Gift className="w-10 h-10" />
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <p className="font-avigea text-2xl text-foreground flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-club-dorado" /> Tenés un regalo del club
                  </p>
                  <p className="text-club-dorado font-bold">{labelCupon(cupon)}</p>
                </div>

                {/* Mensaje libre del admin */}
                <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap px-2">
                  {cupon.mensaje}
                </p>

                <div className="space-y-2 pt-1">
                  <p className="text-muted-foreground text-xs">
                    Se aplica desde el carrito, en un pedido con flores.
                    {cupon.vence_at && <> Válido hasta el {formatFecha(cupon.vence_at)}.</>}
                  </p>
                  <Link
                    href="/socio/tienda"
                    onClick={cerrar}
                    className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                  >
                    Ir a la tienda
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
