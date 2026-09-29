'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, X, Loader2, Ban, Users, CheckCircle2 } from 'lucide-react';
import { crearCuponMasivo, listarLotes, anularLote, type DestinatariosLote, type LoteCupones } from '@/app/actions/cupones';
import { CuponForm, type DatosCuponForm } from './CuponForm';
import { cn, formatFecha } from '@/lib/utils';

const DESTINATARIOS: { value: DestinatariosLote; label: string; desc: string }[] = [
  { value: 'activos',   label: 'Todos los socios activos', desc: 'Cualquier socio con la cuenta activa' },
  { value: 'tienda',    label: 'Con tienda habilitada',    desc: 'Solo los que ya pueden hacer pedidos' },
  { value: 'reprocann', label: 'Con REPROCANN aprobado',   desc: 'Solo los que tienen el certificado aprobado' },
];

// Etiqueta corta del beneficio de un lote
function labelLote(l: LoteCupones): string {
  switch (l.tipo) {
    case 'porcentaje':      return `${l.valor}% de descuento`;
    case 'monto':           return `$${(l.valor ?? 0).toLocaleString('es-AR')} de descuento`;
    case 'envio_gratis':    return 'Envío gratis';
    case 'producto_gratis': return `${l.cantidad ?? 1} × ${l.producto ?? 'producto'} gratis`;
  }
}

// "Cupón para todos": crea un cupón individual por socio (mismo lote) y
// permite anular los que no se usaron de lotes anteriores.
export function CuponMasivoModal({ onClose }: { onClose: () => void }) {
  const [datos, setDatos]       = useState<DatosCuponForm | null>(null);
  const [destinatarios, setDestinatarios] = useState<DestinatariosLote>('activos');
  const [pending, setPending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [exito, setExito]       = useState<number | null>(null);
  const [lotes, setLotes]       = useState<LoteCupones[] | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const cargarLotes = () => listarLotes().then(res => setLotes(res.ok ? res.data : []));
  useEffect(() => { cargarLotes(); }, []);

  async function handleCrear() {
    if (!datos) return;
    setPending(true);
    setError(null);
    const res = await crearCuponMasivo({ ...datos, destinatarios });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setExito(res.data.creados);
    cargarLotes();
  }

  async function handleAnularLote(id: string) {
    setAnulando(id);
    const res = await anularLote(id);
    setAnulando(null);
    if (!res.ok) { setError(res.error); return; }
    cargarLotes();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.7, scaleX: 1.15, y: 28 }}
        animate={{ opacity: 1, scale: 1, scaleX: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 16, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 15, stiffness: 380, mass: 0.8 }}
        className="fixed z-50 inset-x-4 top-[6vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg"
      >
        <div className="bg-club-verde border border-club-verde-claro/30 rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-club-verde-claro/30">
            <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
              <Gift className="w-5 h-5 text-club-dorado" /> Cupón para todos
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            {exito !== null ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Listo: se crearon {exito} cupones. Cada socio va a ver el regalo al entrar.
              </div>
            ) : (
              <>
                {/* Destinatarios */}
                <div className="space-y-1.5">
                  <p className="text-xs text-foreground/80 font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Destinatarios</p>
                  <div className="space-y-1.5">
                    {DESTINATARIOS.map(d => (
                      <button key={d.value} onClick={() => setDestinatarios(d.value)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-xl border transition-all',
                          destinatarios === d.value
                            ? 'bg-club-dorado/10 border-club-dorado/40'
                            : 'bg-white/5 border-white/10 hover:border-club-dorado/30'
                        )}>
                        <p className="text-sm text-foreground font-medium">{d.label}</p>
                        <p className="text-xs text-muted-foreground">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <CuponForm mensajeInicial="¡Gracias por ser parte del club! Este regalo es para vos, que lo disfrutes." onChange={setDatos} />

                {error && (
                  <p className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>
                )}

                <p className="text-muted-foreground text-[11px]">
                  Se crea un cupón personal por socio. Cada uno lo usa una sola vez, en un pedido con flores.
                </p>

                <button onClick={handleCrear} disabled={pending} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Enviar a todos
                </button>
              </>
            )}

            {/* Lotes anteriores */}
            <div className="space-y-2 pt-2 border-t border-club-verde-claro/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Envíos anteriores</p>
              {lotes === null ? (
                <p className="text-xs text-muted-foreground italic">Cargando…</p>
              ) : lotes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Todavía no enviaste cupones masivos.</p>
              ) : (
                lotes.map(l => (
                  <div key={l.lote_id} className="rounded-xl bg-white/5 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{labelLote(l)}</p>
                      <span className="text-[11px] text-muted-foreground">{formatFecha(l.created_at)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs truncate">{l.mensaje}</p>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {l.total} enviados · <span className="text-emerald-400">{l.usados} usados</span> · {l.disponibles} disponibles
                        {l.anulados > 0 && <> · {l.anulados} anulados</>}
                      </span>
                      {l.disponibles > 0 && (
                        <button onClick={() => handleAnularLote(l.lote_id)} disabled={anulando === l.lote_id}
                          className="flex items-center gap-1 text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50">
                          {anulando === l.lote_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                          Anular los no usados
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
