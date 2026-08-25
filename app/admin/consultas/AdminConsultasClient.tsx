'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  HelpCircle, Clock, CheckCircle2, Loader2, Phone, Mail,
  MessageSquareText, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { atenderConsulta } from '@/app/actions/consultas';
import { cn, formatFecha } from '@/lib/utils';
import type { ConsultaConSocio, EstadoConsulta } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const LABEL_TIPO: Record<string, string> = {
  general: 'General', pedidos: 'Pedidos', reprocann: 'REPROCANN', pagos: 'Pagos',
};

function ConsultaCard({ consulta }: { consulta: ConsultaConSocio }) {
  const router = useRouter();
  const [respuesta, setRespuesta] = useState('');
  const [abierta, setAbierta]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleAtender = async () => {
    setLoading(true);
    setError(null);
    const res = await atenderConsulta(consulta.id, respuesta);
    setLoading(false);
    if (!res.ok) { setError(res.error ?? 'Error'); return; }
    router.refresh();
  };

  return (
    <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-foreground font-semibold">{consulta.profiles.nombre}</p>
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1">
            {consulta.profiles.telefono && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {consulta.profiles.telefono}</span>
            )}
            {consulta.profiles.email && (
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {consulta.profiles.email}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span className="px-2 py-0.5 rounded-full border border-club-verde-claro/40 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
            {LABEL_TIPO[consulta.tipo] ?? consulta.tipo}
          </span>
          <span className="text-muted-foreground">{formatFecha(consulta.created_at, 'dd MMM · HH:mm')}</span>
          {consulta.estado === 'pendiente' ? (
            <span className="flex items-center gap-1 text-amber-400 font-semibold"><Clock className="w-3.5 h-3.5" /> Pendiente</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Atendida</span>
          )}
        </div>
      </div>

      <p className="text-foreground/90 text-sm leading-relaxed">{consulta.mensaje}</p>

      {consulta.estado === 'atendida' && consulta.respuesta && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-club-dorado/8 border border-club-dorado/20">
          <MessageSquareText className="w-4 h-4 text-club-dorado shrink-0 mt-0.5" />
          <p className="text-foreground/90 text-sm leading-relaxed">{consulta.respuesta}</p>
        </div>
      )}

      {consulta.estado === 'pendiente' && (
        <div className="space-y-2">
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {abierta ? (
            <>
              <textarea
                value={respuesta}
                onChange={e => setRespuesta(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Respuesta breve para el socio (opcional — la ve en la app)"
                className="input-club w-full resize-none text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAbierta(false)}
                  className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAtender}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-club-dorado/15 hover:bg-club-dorado/25 border border-club-dorado/30 text-club-dorado font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Marcar atendida
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setAbierta(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-club-dorado/15 hover:bg-club-dorado/25 border border-club-dorado/30 text-club-dorado font-semibold transition-colors"
              >
                <MessageSquareText className="w-3.5 h-3.5" /> Responder / atender
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function AdminConsultasClient({ consultas }: { consultas: ConsultaConSocio[] }) {
  const [filtro, setFiltro] = useState<'todas' | EstadoConsulta>('pendiente');

  const filtradas = consultas.filter(c => filtro === 'todas' || c.estado === filtro);
  const pendientes = consultas.filter(c => c.estado === 'pendiente').length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        icon={<HelpCircle className="w-5 h-5" />}
        title="Consultas"
        subtitle={pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'} de atender` : 'Sin pendientes'}
      />

      {/* Filtro por estado */}
      <motion.div variants={fadeUp} className="flex items-center gap-1 p-1 glass-card w-fit rounded-xl">
        {([['pendiente', 'Pendientes'], ['atendida', 'Atendidas'], ['todas', 'Todas']] as const).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filtro === valor
                ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {filtradas.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-10 text-center space-y-2">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {filtro === 'pendiente' ? 'No hay consultas pendientes. 🎉' : 'No hay consultas para mostrar.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(c => <ConsultaCard key={c.id} consulta={c} />)}
        </div>
      )}
    </motion.div>
  );
}
