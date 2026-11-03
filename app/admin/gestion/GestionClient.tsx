'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardCheck, Plus, X, Loader2, Check, Pencil, Trash2, Repeat, AlertTriangle, ChevronDown, RotateCcw } from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { crearTarea, editarTarea, completarTarea, reabrirTarea, eliminarTarea } from '@/app/actions/tareas';
import type { Tarea, RecurrenciaTarea } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const RECURRENCIA_LABEL: Record<RecurrenciaTarea, string> = { ninguna: 'Una vez', mensual: 'Todos los meses', anual: 'Todos los años' };

function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sumarDias(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return hoyISO(new Date(y, m - 1, d + n));
}

// Bloque al que pertenece una tarea pendiente según su vencimiento
type Bloque = 'vencidas' | 'hoy' | 'semana' | 'proximas';
function bloqueDe(t: Tarea, hoy: string): Bloque {
  if (t.vence_at < hoy) return 'vencidas';
  if (t.vence_at === hoy) return 'hoy';
  if (t.vence_at <= sumarDias(hoy, 7)) return 'semana';
  return 'proximas';
}
const BLOQUES: { k: Bloque; label: string; color: string; borde: string }[] = [
  { k: 'vencidas', label: 'Vencidas',    color: 'text-red-400',     borde: 'border-red-400/40' },
  { k: 'hoy',      label: 'Hoy',         color: 'text-club-dorado', borde: 'border-club-dorado/50' },
  { k: 'semana',   label: 'Esta semana', color: 'text-amber-300',   borde: 'border-amber-300/40' },
  { k: 'proximas', label: 'Próximas',    color: 'text-foreground',  borde: 'border-white/15' },
];

interface Props { tareas: Tarea[]; errorMsg: string | null }

export function GestionClient({ tareas, errorMsg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<{ tarea?: Tarea } | null>(null);
  const [confirmar, setConfirmar] = useState<Tarea | null>(null);
  const [verHechas, setVerHechas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const hoy = hoyISO();

  const pendientes = useMemo(() => tareas.filter(t => !t.hecha_at), [tareas]);
  const hechas = useMemo(() => tareas.filter(t => t.hecha_at).sort((a, b) => (a.hecha_at! < b.hecha_at! ? 1 : -1)).slice(0, 60), [tareas]);
  const porBloque = useMemo(() => {
    const m: Record<Bloque, Tarea[]> = { vencidas: [], hoy: [], semana: [], proximas: [] };
    for (const t of pendientes) m[bloqueDe(t, hoy)].push(t);
    return m;
  }, [pendientes, hoy]);

  const completar = (t: Tarea) => {
    setOcupada(t.id); setError(null);
    startTransition(async () => {
      const r = await completarTarea(t.id);
      setOcupada(null);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  };
  const reabrir = (t: Tarea) => startTransition(async () => { const r = await reabrirTarea(t.id); if (!r.ok) setError(r.error); router.refresh(); });
  const eliminar = (t: Tarea, serie: boolean) => startTransition(async () => {
    const r = await eliminarTarea(t.id, serie); if (!r.ok) setError(r.error); setConfirmar(null); router.refresh();
  });

  const Fila = ({ t, hecha = false }: { t: Tarea; hecha?: boolean }) => (
    <div className={cn('flex items-start gap-3 px-4 py-3', hecha && 'opacity-60')}>
      <button onClick={() => hecha ? reabrir(t) : completar(t)} disabled={pending && ocupada === t.id}
        title={hecha ? 'Volver a pendiente' : 'Marcar hecha'}
        className={cn('mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
          hecha ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30 hover:border-club-dorado hover:bg-club-dorado/10')}>
        {pending && ocupada === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hecha ? <Check className="w-4 h-4" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', hecha ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {t.titulo}
          {t.recurrencia !== 'ninguna' && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 text-muted-foreground"><Repeat className="w-3 h-3" /> {RECURRENCIA_LABEL[t.recurrencia]}</span>
          )}
        </p>
        {t.notas && <p className="text-muted-foreground text-xs mt-0.5 whitespace-pre-wrap">{t.notas}</p>}
        <p className="text-muted-foreground text-[11px] mt-1">
          Vence {formatFecha(t.vence_at, "EEEE d 'de' MMMM")}
          {hecha && t.hecha_at && <> · hecha el {formatFecha(t.hecha_at, 'dd/MM/yyyy')}</>}
        </p>
      </div>
      {!hecha && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setModal({ tarea: t })} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setConfirmar(t)} className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {hecha && (
        <button onClick={() => reabrir(t)} title="Reabrir" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground shrink-0"><RotateCcw className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<ClipboardCheck className="w-5 h-5" />} title="Gestión" subtitle="Tareas del club con vencimiento · solo superadmin"
        action={<button onClick={() => setModal({})} className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva tarea</button>} />

      {errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{errorMsg}</p></motion.div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>
      )}

      {pendientes.length === 0 && !errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center space-y-2">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Sin tareas pendientes. Creá la primera, por ejemplo &quot;Pagar sueldos&quot; todos los meses.</p>
        </motion.div>
      )}

      {BLOQUES.map(b => porBloque[b.k].length > 0 && (
        <motion.div key={b.k} variants={fadeUp} className={cn('glass-card overflow-hidden border-l-2', b.borde)}>
          <div className="px-4 py-2.5 border-b border-club-verde-claro/15 flex items-center justify-between">
            <p className={cn('text-xs font-semibold uppercase tracking-widest', b.color)}>{b.label}</p>
            <span className="text-xs text-muted-foreground">{porBloque[b.k].length}</span>
          </div>
          <div className="divide-y divide-club-verde-claro/10">
            {porBloque[b.k].map(t => <Fila key={t.id} t={t} />)}
          </div>
        </motion.div>
      ))}

      {hechas.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card overflow-hidden">
          <button onClick={() => setVerHechas(v => !v)} className="w-full px-4 py-2.5 flex items-center justify-between text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Hechas · {hechas.length}</p>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', verHechas && 'rotate-180')} />
          </button>
          {verHechas && <div className="divide-y divide-club-verde-claro/10 border-t border-club-verde-claro/15">{hechas.map(t => <Fila key={t.id} t={t} hecha />)}</div>}
        </motion.div>
      )}

      {modal && <TareaModal tarea={modal.tarea} onClose={() => { setModal(null); router.refresh(); }} />}

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmar(null)}>
          <div onClick={e => e.stopPropagation()} className="glass-card w-full max-w-sm p-6 text-center space-y-4">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-foreground font-semibold">¿Eliminar &quot;{confirmar.titulo}&quot;?</p>
            {confirmar.recurrencia !== 'ninguna' && <p className="text-muted-foreground text-xs">Es una tarea repetitiva. Podés borrar solo esta ocurrencia o toda la serie pendiente.</p>}
            <div className="flex flex-col gap-2">
              <button onClick={() => eliminar(confirmar, false)} disabled={pending} className="py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold">Eliminar esta</button>
              {confirmar.recurrencia !== 'ninguna' && (
                <button onClick={() => eliminar(confirmar, true)} disabled={pending} className="py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-sm">Eliminar toda la serie</button>
              )}
              <button onClick={() => setConfirmar(null)} className="btn-secondary py-2.5">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TareaModal({ tarea, onClose }: { tarea?: Tarea; onClose: () => void }) {
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [notas, setNotas] = useState(tarea?.notas ?? '');
  const [vence, setVence] = useState(tarea?.vence_at ?? hoyISO());
  const [recurrencia, setRecurrencia] = useState<RecurrenciaTarea>(tarea?.recurrencia ?? 'ninguna');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = tarea
      ? await editarTarea(tarea.id, { titulo, notas, vence_at: vence, recurrencia })
      : await crearTarea({ titulo, notas, vence_at: vence, recurrencia });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-club-dorado" /> {tarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className="input-club w-full" placeholder="Pagar sueldos, subir libro de actas…" required autoFocus />
          </div>
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="input-club w-full resize-none" placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Vence *</label>
              <input type="date" value={vence} onChange={e => setVence(e.target.value)} className="input-club w-full" required />
            </div>
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Se repite</label>
              <select value={recurrencia} onChange={e => setRecurrencia(e.target.value as RecurrenciaTarea)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
                {(Object.keys(RECURRENCIA_LABEL) as RecurrenciaTarea[]).map(r => <option key={r} value={r}>{RECURRENCIA_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          {recurrencia !== 'ninguna' && (
            <p className="text-muted-foreground text-[11px]">Al marcarla hecha se crea sola la del {recurrencia === 'mensual' ? 'mes' : 'año'} siguiente, mismo día.</p>
          )}
          {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button type="submit" disabled={pending} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : tarea ? 'Guardar' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
