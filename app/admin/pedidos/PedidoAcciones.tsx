'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, MessageSquare, X, Loader2, Send } from 'lucide-react';
import { reprogramarPedido, enviarMensajePedido } from '@/app/actions/pedidos';
import { cn, formatNumeroPedido, DIAS_SEMANA } from '@/lib/utils';
import type { FranjaHoraria } from '@/lib/types/database';
import { nombrePedido, type PedidoAdmin } from './AdminPedidosClient';

// ============================================================
// Reprogramar entrega: el admin elige franja + fecha (próximos 21 días,
// sin anticipación mínima) y el socio recibe una notificación.
// ============================================================
export function ReprogramarModal({ pedido, franjas, onClose, onDone }: {
  pedido: PedidoAdmin; franjas: FranjaHoraria[]; onClose: () => void;
  onDone: (entrega_franja: string, entrega_fecha: string) => void;
}) {
  const [sel, setSel] = useState<{ franjaId: string; fecha: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opciones: cada franja activa en cada uno de los próximos 21 días que le corresponden
  const opciones = useMemo(() => {
    const hoy = new Date();
    const out: { franja: FranjaHoraria; fecha: string; label: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      for (const f of franjas) {
        if (!f.activa || !(f.dias_semana ?? []).includes(d.getDay())) continue;
        out.push({ franja: f, fecha, label: `${DIAS_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)} hs` });
      }
    }
    return out;
  }, [franjas]);

  const confirmar = async () => {
    if (!sel) return;
    setPending(true); setError(null);
    const res = await reprogramarPedido(pedido.id, sel.franjaId, sel.fecha);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.data.entrega_franja, res.data.entrega_fecha);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><CalendarClock className="w-5 h-5 text-club-dorado" /> Reprogramar entrega</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-muted-foreground text-xs">
          Pedido <span className="text-club-dorado font-semibold">{formatNumeroPedido(pedido.numero)}</span> · {nombrePedido(pedido)}.
          Entrega actual: <span className="text-foreground">{pedido.entrega_franja ?? 'sin horario'}</span>.
          {!pedido.manual && ' El socio recibe una notificación con el cambio.'}
        </p>

        {opciones.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay franjas activas con días asignados.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
            {opciones.map(o => {
              const activa = sel?.franjaId === o.franja.id && sel?.fecha === o.fecha;
              const esActual = o.label === pedido.entrega_franja;
              return (
                <button key={`${o.franja.id}:${o.fecha}`} type="button" onClick={() => setSel({ franjaId: o.franja.id, fecha: o.fecha })}
                  className={cn('px-3 py-2 rounded-xl text-sm font-medium border transition-all',
                    activa ? 'bg-club-dorado text-club-verde border-club-dorado'
                    : esActual ? 'bg-white/5 text-muted-foreground border-club-dorado/30'
                    : 'bg-club-verde-claro/15 text-muted-foreground border-white/10 hover:border-club-dorado/40 hover:text-foreground')}>
                  {o.label}{esActual && <span className="ml-1 text-[10px]">(actual)</span>}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={pending || !sel} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reprogramar y avisar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Mensaje del club al socio sobre un pedido (llega a su campana)
// ============================================================
export function MensajeModal({ pedido, onClose }: { pedido: PedidoAdmin; onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    setPending(true); setError(null);
    const res = await enviarMensajePedido(pedido.id, texto);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setEnviado(true);
    setTimeout(onClose, 1200);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><MessageSquare className="w-5 h-5 text-club-dorado" /> Escribir al socio</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-muted-foreground text-xs">
          Sobre el pedido <span className="text-club-dorado font-semibold">{formatNumeroPedido(pedido.numero)}</span> de {nombrePedido(pedido)}.
          Le llega como notificación en la app.
        </p>
        {pedido.notas && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs">
            <span className="text-foreground/70 font-medium">Su nota: </span><span className="text-muted-foreground">{pedido.notas}</span>
          </div>
        )}
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} maxLength={1000} autoFocus
          className="input-club w-full resize-none text-sm" placeholder="Ej: Vimos tu nota, te lo llevamos el sábado a la tarde." />
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <button type="button" onClick={enviar} disabled={pending || enviado || !texto.trim()} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : enviado ? 'Enviado' : <><Send className="w-4 h-4" /> Enviar</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
