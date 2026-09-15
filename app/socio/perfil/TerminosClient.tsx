'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { aceptarTerminos } from '@/app/actions/perfil';
import { TerminosTexto } from '@/components/terminos/TerminosTexto';
import { TerminosModal } from '@/components/terminos/TerminosModal';
import { formatFecha } from '@/lib/utils';

interface Props {
  aceptadosAt: string | null;
}

// Sección "Términos y condiciones" del perfil.
// Pendiente: muestra el texto completo + checkbox + botón "Aceptar".
// Aceptado: muestra la fecha y un botón para releer el texto en un modal.
export function TerminosClient({ aceptadosAt }: Props) {
  const [aceptadoLocal, setAceptadoLocal] = useState(aceptadosAt);
  const [marcado, setMarcado]             = useState(false);
  const [modal, setModal]                 = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [pending, startTransition]        = useTransition();

  const handleAceptar = () => {
    setError(null);
    startTransition(async () => {
      const res = await aceptarTerminos();
      if (res.ok) setAceptadoLocal(new Date().toISOString());
      else setError(res.error);
    });
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-avigea text-xl text-foreground mb-1 flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-club-dorado" />
        Términos y condiciones
      </h2>

      {aceptadoLocal ? (
        <>
          <p className="text-muted-foreground text-xs mb-5">
            Podés releer los términos que aceptaste en cualquier momento.
          </p>
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Aceptados el {formatFecha(aceptadoLocal)}
            </div>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="flex items-center gap-1.5 text-xs text-club-dorado hover:text-club-dorado/80 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver términos
            </button>
          </div>
          <TerminosModal abierto={modal} onCerrar={() => setModal(false)} />
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-xs mb-5">
            Leé y aceptá los términos para habilitar la tienda.
          </p>

          {/* Texto completo con scroll propio para no estirar la página */}
          <div className="max-h-80 overflow-y-auto pr-3 p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
            <TerminosTexto />
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
            <input
              type="checkbox"
              checked={marcado}
              onChange={e => setMarcado(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-club-dorado"
            />
            <span className="text-sm text-foreground/90">
              Leí y acepto los términos y condiciones. Declaro ser mayor de 18 años y contar con vínculo REPROCANN vigente con la Asociación.
            </span>
          </label>

          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleAceptar}
              disabled={!marcado || pending}
              className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><CheckCircle2 className="w-4 h-4" /> Aceptar términos</>}
            </motion.button>
          </div>
        </>
      )}
    </div>
  );
}
