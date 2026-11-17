'use client';

import { useMemo, useState, useTransition } from 'react';
import { CalendarOff, Loader2, Lock, Unlock, Plus } from 'lucide-react';
import { toggleBloqueoFecha, bloquearRangoFechas } from '@/app/actions/configuracion';
import { cn, DIAS_SEMANA, estaBloqueada } from '@/lib/utils';
import type { FranjaHoraria, FechaBloqueada } from '@/lib/types/database';

const DIAS_VENTANA = 30;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  franjas:   FranjaHoraria[];
  bloqueos:  FechaBloqueada[];
  // Pedidos activos (pendiente / listo) con entrega en cada fecha, para avisar antes de bloquear
  pedidosPorFecha: Record<string, number>;
}

// Calendario de entregas (solo superadmin): los próximos 30 días con sus franjas.
// Cada día o franja se puede bloquear (vacaciones, feriados): lo bloqueado
// no se le ofrece al socio al confirmar el pedido.
export function CalendarioEntregas({ franjas, bloqueos: inicial, pedidosPorFecha }: Props) {
  const [bloqueos, setBloqueos] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bloquear rango (vacaciones)
  const hoy = iso(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [motivo, setMotivo] = useState('Vacaciones');

  // Días con al menos una franja activa en la ventana
  const dias = useMemo(() => {
    const out: { fecha: string; label: string; franjas: FranjaHoraria[] }[] = [];
    const base = new Date();
    for (let i = 0; i < DIAS_VENTANA; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const fs = franjas.filter(f => f.activa && (f.dias_semana ?? []).includes(d.getDay()));
      if (fs.length === 0) continue;
      out.push({ fecha: iso(d), label: `${DIAS_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, franjas: fs });
    }
    return out;
  }, [franjas]);

  const motivoDe = (fecha: string, franjaId: string | null) =>
    bloqueos.find(b => b.fecha === fecha && b.franja_id === franjaId)?.motivo ?? null;

  const toggle = (fecha: string, franjaId: string | null, bloquear: boolean) => {
    const pedidos = pedidosPorFecha[fecha] ?? 0;
    if (bloquear && pedidos > 0 && !confirm(`Ese día hay ${pedidos} pedido${pedidos === 1 ? '' : 's'} activo${pedidos === 1 ? '' : 's'} con entrega. Bloquearlo no los cambia: reprogramalos desde Pedidos. ¿Bloquear igual?`)) return;
    const key = `${fecha}:${franjaId ?? 'dia'}`;
    setOcupado(key); setError(null);
    startTransition(async () => {
      const res = await toggleBloqueoFecha(fecha, franjaId, bloquear, motivo);
      setOcupado(null);
      if (!res.ok) { setError(res.error); return; }
      setBloqueos(prev => bloquear && res.data
        ? [...prev, res.data]
        : prev.filter(b => !(b.fecha === fecha && b.franja_id === franjaId)));
    });
  };

  const bloquearRango = () => {
    setError(null);
    startTransition(async () => {
      const res = await bloquearRangoFechas(desde, hasta, motivo);
      if (!res.ok) { setError(res.error); return; }
      setBloqueos(prev => [...prev, ...res.data]);
    });
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <p className="text-foreground font-medium text-sm flex items-center gap-2"><CalendarOff className="w-4 h-4 text-club-dorado" /> Calendario de entregas · próximos {DIAS_VENTANA} días</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          Bloqueá un día entero o una franja puntual (vacaciones, feriados). Lo bloqueado no le aparece al socio al confirmar el pedido. Solo superadmin.
        </p>
      </div>

      {/* Bloquear rango */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-[11px] text-foreground/70 font-medium mb-1 block">Desde</label>
          <input type="date" value={desde} min={hoy} onChange={e => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }} className="input-club w-full py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-foreground/70 font-medium mb-1 block">Hasta</label>
          <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className="input-club w-full py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-foreground/70 font-medium mb-1 block">Motivo</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} className="input-club w-full py-1.5 text-sm" placeholder="Vacaciones" />
        </div>
        <button onClick={bloquearRango} disabled={pending}
          className="py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {pending && !ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Bloquear días</>}
        </button>
      </div>

      {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}

      {dias.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">No hay franjas activas con días asignados en los próximos {DIAS_VENTANA} días.</p>
      ) : (
        <div className="divide-y divide-club-verde-claro/10">
          {dias.map(d => {
            const diaBloqueado = bloqueos.some(b => b.fecha === d.fecha && b.franja_id === null);
            const pedidos = pedidosPorFecha[d.fecha] ?? 0;
            const motivoDia = motivoDe(d.fecha, null);
            return (
              <div key={d.fecha} className={cn('py-2.5 flex flex-wrap items-center gap-2', diaBloqueado && 'opacity-80')}>
                <div className="w-32 shrink-0">
                  <p className={cn('text-sm font-semibold', diaBloqueado ? 'text-red-400 line-through' : 'text-foreground')}>{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {diaBloqueado ? (motivoDia ?? 'Bloqueado') : pedidos > 0 ? `${pedidos} pedido${pedidos === 1 ? '' : 's'}` : 'Sin pedidos'}
                  </p>
                </div>

                {/* Franjas del día */}
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {d.franjas.map(f => {
                    const bloq = estaBloqueada(bloqueos, d.fecha, f.id);
                    const soloFranja = bloqueos.some(b => b.fecha === d.fecha && b.franja_id === f.id);
                    const key = `${d.fecha}:${f.id}`;
                    return (
                      <button key={f.id} type="button" disabled={diaBloqueado || (pending && ocupado === key)}
                        onClick={() => toggle(d.fecha, f.id, !soloFranja)}
                        title={diaBloqueado ? 'El día entero está bloqueado' : soloFranja ? `Bloqueada${motivoDe(d.fecha, f.id) ? `: ${motivoDe(d.fecha, f.id)}` : ''} · tocá para habilitar` : 'Habilitada · tocá para bloquear'}
                        className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:cursor-not-allowed',
                          bloq ? 'bg-red-500/10 border-red-500/30 text-red-400 line-through' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:border-red-400/50')}>
                        {pending && ocupado === key ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)}`}
                      </button>
                    );
                  })}
                </div>

                {/* Día entero */}
                <button type="button" onClick={() => toggle(d.fecha, null, !diaBloqueado)} disabled={pending && ocupado === `${d.fecha}:dia`}
                  className={cn('shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all',
                    diaBloqueado ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' : 'bg-white/5 border-white/15 text-muted-foreground hover:text-red-400 hover:border-red-400/40')}>
                  {pending && ocupado === `${d.fecha}:dia` ? <Loader2 className="w-3 h-3 animate-spin" />
                    : diaBloqueado ? <><Unlock className="w-3 h-3" /> Habilitar día</> : <><Lock className="w-3 h-3" /> Bloquear día</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
