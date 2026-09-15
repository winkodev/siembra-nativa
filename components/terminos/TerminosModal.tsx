'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScrollText } from 'lucide-react';
import { TerminosTexto } from './TerminosTexto';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

// Modal de solo lectura con el texto completo de los T&C.
// Se renderiza en un portal sobre <body>: dentro de PageTransition (motion.div
// con transform) un `fixed` queda atrapado y otras tarjetas se dibujan encima.
// Fondo opaco a propósito: el texto tiene que leerse sin que se cuele lo de atrás.
export function TerminosModal({ abierto, onCerrar }: Props) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={onCerrar}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl flex flex-col max-h-[90vh] rounded-xl bg-club-verde border border-club-dorado/30 shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-5 border-b border-club-verde-claro/20">
              <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-club-dorado" />
                Términos y condiciones
              </h2>
              <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <TerminosTexto />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
