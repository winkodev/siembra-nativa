'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Megaphone, Plus, X, Loader2, Eye, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsletterTabs } from '../NewsletterTabs';
import { crearAnuncio, toggleAnuncio } from '@/app/actions/anuncios';
import type { Anuncio } from '@/lib/types/database';

export type AnuncioVista = Anuncio & { vistos: number };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Estado visible de un anuncio: activo, vencido o desactivado
function estadoDe(a: Anuncio): { label: string; color: string } {
  if (!a.activo) return { label: 'Desactivado', color: 'text-muted-foreground border-white/15 bg-white/5' };
  if (a.vigente_hasta && a.vigente_hasta < hoyISO()) return { label: 'Vencido', color: 'text-muted-foreground border-white/15 bg-white/5' };
  return { label: 'Visible', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' };
}

export function AnunciosClient({ anuncios, errorMsg }: { anuncios: AnuncioVista[]; errorMsg: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const toggle = (a: AnuncioVista) => startTransition(async () => {
    const r = await toggleAnuncio(a.id, !a.activo);
    if (!r.ok) setError(r.error);
    router.refresh();
  });

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<Megaphone className="w-5 h-5" />} title="Newsletter" subtitle="Anuncios: un aviso que le aparece al socio al entrar, una sola vez, y queda en sus notificaciones"
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo anuncio</button>} />
      <NewsletterTabs />

      {errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{errorMsg}</p></motion.div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>
      )}
      {aviso && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {aviso}</span>
          <button onClick={() => setAviso(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {anuncios.length === 0 && !errorMsg ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center space-y-2">
          <Megaphone className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Todavía no publicaste anuncios. Ejemplo: &quot;Vacaciones: no hay entregas del 20 al 30 de diciembre&quot;.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {anuncios.map(a => {
            const est = estadoDe(a);
            return (
              <motion.div key={a.id} variants={fadeUp} className={cn('glass-card p-5 space-y-2', (!a.activo || est.label === 'Vencido') && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">{a.titulo}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Publicado {formatFecha(a.created_at, "dd/MM/yyyy · HH:mm")}
                      {' · '}{a.destinatarios === 'tienda' ? 'Socios con tienda habilitada' : 'Todos los socios activos'}
                      {a.vigente_hasta && <> · hasta el {formatFecha(a.vigente_hasta)}</>}
                    </p>
                  </div>
                  <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] border', est.color)}>{est.label}</span>
                </div>
                <p className="text-foreground/80 text-sm whitespace-pre-wrap">{a.mensaje}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {a.vistos} socio{a.vistos === 1 ? '' : 's'} lo {a.vistos === 1 ? 'vio' : 'vieron'}</span>
                  <button onClick={() => toggle(a)} disabled={pending}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:opacity-50">
                    {a.activo ? <><ToggleRight className="w-5 h-5 text-club-dorado" /> Desactivar</> : <><ToggleLeft className="w-5 h-5" /> Reactivar</>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {modal && <NuevoAnuncioModal onClose={(msg) => { setModal(false); if (msg) setAviso(msg); router.refresh(); }} />}
    </motion.div>
  );
}

function NuevoAnuncioModal({ onClose }: { onClose: (msg?: string) => void }) {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [destinatarios, setDestinatarios] = useState<'activos' | 'tienda'>('activos');
  const [hasta, setHasta] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = await crearAnuncio({ titulo, mensaje, destinatarios, vigente_hasta: hasta || null });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose(`Publicado. Llegó a la campana de ${res.data.notificados} socio${res.data.notificados === 1 ? '' : 's'} y les va a aparecer al entrar.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><Megaphone className="w-5 h-5 text-club-dorado" /> Nuevo anuncio</h2>
          <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className="input-club w-full" placeholder="Vacaciones de fin de año" required autoFocus />
          </div>
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Mensaje *</label>
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={5} maxLength={2000} className="input-club w-full resize-none"
              placeholder="No hay entregas del 20 al 30 de diciembre. Los pedidos de esa semana salen el 2 de enero. ¡Felices fiestas!" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Para</label>
              <select value={destinatarios} onChange={e => setDestinatarios(e.target.value as 'activos' | 'tienda')} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
                <option value="activos">Todos los socios activos</option>
                <option value="tienda">Solo con tienda habilitada</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Mostrar hasta</label>
              <input type="date" value={hasta} min={hoyISO()} onChange={e => setHasta(e.target.value)} className="input-club w-full" />
              <p className="text-muted-foreground text-[11px] mt-1">Opcional. Vacío = hasta que lo desactives.</p>
            </div>
          </div>

          {/* Vista previa del popup */}
          {(titulo || mensaje) && (
            <div className="rounded-2xl border-2 border-club-dorado/40 bg-club-verde p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-club-dorado font-semibold">Vista previa · Aviso del club</p>
              <p className="font-avigea text-lg text-foreground leading-tight">{titulo || 'Título'}</p>
              <p className="text-foreground/80 text-sm whitespace-pre-wrap">{mensaje || 'Mensaje'}</p>
            </div>
          )}

          {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => onClose()} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button type="submit" disabled={pending} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
