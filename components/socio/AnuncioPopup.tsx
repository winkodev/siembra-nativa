'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Check } from 'lucide-react';
import { misAnunciosPendientes, marcarAnuncioVisto } from '@/app/actions/anuncios';
import type { Anuncio } from '@/lib/types/database';

// Popup de anuncios del club: muestra los pendientes de a uno; "Entendido"
// lo marca visto y pasa al siguiente. Cuando no quedan, avisa con onDone
// (así el popup del cupón espera su turno y nunca se superponen).
// Sin animación de salida: sobre fondo desenfocado parpadea (ver lecciones).
export function AnuncioPopup({ onDone }: { onDone: () => void }) {
  const [cola, setCola] = useState<Anuncio[] | null>(null);

  useEffect(() => {
    misAnunciosPendientes().then(res => {
      const pendientes = res.ok ? res.data : [];
      setCola(pendientes);
      if (pendientes.length === 0) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cola || cola.length === 0) return null;
  const actual = cola[0];

  function entendido() {
    marcarAnuncioVisto(actual.id);   // no bloquea: si falla, vuelve a aparecer la próxima vez
    const resto = cola!.slice(1);
    setCola(resto);
    if (resto.length === 0) onDone();
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
      {/* key por anuncio: cada uno entra con su propia animación */}
      <motion.div
        key={actual.id}
        initial={{ opacity: 0, scale: 0.6, scaleX: 1.2, y: 50 }}
        animate={{ opacity: 1, scale: 1, scaleX: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14, mass: 0.9 }}
        className="fixed z-[70] inset-x-4 top-[14vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md"
      >
        <div className="relative bg-club-verde border-2 border-club-dorado/60 rounded-3xl shadow-2xl shadow-club-dorado/20 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-club-dorado/15 blur-3xl pointer-events-none" />

          <div className="relative px-6 pt-8 pb-6 space-y-4">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -12, 10, -6, 0] }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="w-12 h-12 rounded-2xl bg-club-dorado/15 border border-club-dorado/40 flex items-center justify-center text-club-dorado shrink-0"
              >
                <Megaphone className="w-6 h-6" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-club-dorado font-semibold">Aviso del club</p>
                <p className="font-avigea text-xl text-foreground leading-tight">{actual.titulo}</p>
              </div>
            </div>

            <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">{actual.mensaje}</p>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted-foreground text-[11px]">
                {cola.length > 1 ? `1 de ${cola.length} avisos` : 'Lo podés volver a leer en las notificaciones'}
              </span>
              <motion.button whileTap={{ scale: 0.95 }} onClick={entendido}
                className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> Entendido
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
