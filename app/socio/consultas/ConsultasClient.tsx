'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { HelpCircle, Send, Loader2, Clock, CheckCircle2, MessageSquareText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { crearConsulta } from '@/app/actions/consultas';
import { cn, formatFecha } from '@/lib/utils';
import type { Consulta, TipoConsulta } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const TIPOS: { value: TipoConsulta; label: string }[] = [
  { value: 'general',   label: 'General' },
  { value: 'pedidos',   label: 'Pedidos' },
  { value: 'reprocann', label: 'REPROCANN' },
  { value: 'pagos',     label: 'Pagos' },
];

export function ConsultasClient({ consultas }: { consultas: Consulta[] }) {
  const router = useRouter();
  const [tipo, setTipo]       = useState<TipoConsulta>('general');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const handleEnviar = async () => {
    if (!mensaje.trim()) return;
    setLoading(true);
    setError(null);
    const res = await crearConsulta(tipo, mensaje);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setMensaje('');
    setTipo('general');
    setEnviada(true);
    setTimeout(() => setEnviada(false), 4000);
    router.refresh();
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        icon={<HelpCircle className="w-5 h-5" />}
        title="Consultas"
        subtitle="Dejanos tu duda y te contactamos"
      />

      {/* Nueva consulta */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        {enviada && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Recibimos tu consulta. Te vamos a contactar a la brevedad.
          </motion.div>
        )}
        {error && (
          <div className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="text-sm text-foreground/70 font-medium mb-2 block">Tema</label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  tipo === t.value
                    ? 'bg-club-dorado text-club-verde border-club-dorado'
                    : 'bg-transparent text-muted-foreground border-club-verde-claro/40 hover:border-club-dorado/50 hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-foreground/70 font-medium mb-2 block">Tu consulta</label>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Contanos tu duda o lo que necesitás..."
            className="input-club w-full resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleEnviar}
            disabled={loading || !mensaje.trim()}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Send className="w-4 h-4" /> Enviar consulta</>}
          </button>
        </div>
      </motion.div>

      {/* Historial */}
      {consultas.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Tus consultas
          </p>
          {consultas.map(c => (
            <div key={c.id} className="glass-card p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full border border-club-verde-claro/40 font-semibold uppercase tracking-wide text-[10px]">
                    {TIPOS.find(t => t.value === c.tipo)?.label ?? c.tipo}
                  </span>
                  <span>{formatFecha(c.created_at, 'dd MMM yyyy · HH:mm')}</span>
                </div>
                {c.estado === 'pendiente' ? (
                  <span className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" /> Pendiente
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Atendida
                  </span>
                )}
              </div>

              <p className="text-foreground text-sm leading-relaxed">{c.mensaje}</p>

              {c.respuesta && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-club-dorado/8 border border-club-dorado/20">
                  <MessageSquareText className="w-4 h-4 text-club-dorado shrink-0 mt-0.5" />
                  <div>
                    <p className="text-club-dorado text-[11px] font-semibold uppercase tracking-wide mb-0.5">
                      Respuesta del club
                    </p>
                    <p className="text-foreground/90 text-sm leading-relaxed">{c.respuesta}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
