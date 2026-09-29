'use client';

import { useEffect, useState } from 'react';
import { Gift, Loader2, Plus, X, Ban, Check } from 'lucide-react';
import { crearCupon, anularCupon, listarCuponesSocio } from '@/app/actions/cupones';
import { CuponForm, type DatosCuponForm } from './CuponForm';
import { labelCupon } from '@/lib/utils/cupones';
import { cn, formatFecha } from '@/lib/utils';
import type { CuponConProducto } from '@/lib/types/database';

const ESTADO_BADGE: Record<string, string> = {
  disponible: 'text-club-dorado bg-club-dorado/10 border-club-dorado/30',
  usado:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  anulado:    'text-muted-foreground bg-white/5 border-white/10',
};

// Sección "Cupones" del drawer del socio (Admin → Socios):
// alta de cupón personal con mensaje libre, listado y anulación.
export function CuponesSocio({ socioId, socioNombre }: { socioId: string; socioNombre: string }) {
  const [cupones, setCupones] = useState<CuponConProducto[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [datos, setDatos]     = useState<DatosCuponForm | null>(null);

  useEffect(() => {
    listarCuponesSocio(socioId).then(res => setCupones(res.ok ? res.data : []));
  }, [socioId]);

  async function handleCrear() {
    if (!datos) return;
    setPending(true);
    setError(null);
    const res = await crearCupon({ socio_id: socioId, ...datos });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setCupones(prev => [res.data, ...(prev ?? [])]);
    setAbierto(false);
  }

  async function handleAnular(id: string) {
    setPending(true);
    const res = await anularCupon(id);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setCupones(prev => (prev ?? []).map(c => c.id === id ? { ...c, estado: 'anulado' } : c));
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Cupones
        </p>
        <button
          onClick={() => setAbierto(v => !v)}
          className="flex items-center gap-1 text-xs text-club-dorado hover:text-club-dorado/80 transition-colors"
        >
          {abierto ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Nuevo cupón</>}
        </button>
      </div>

      {error && (
        <p className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>
      )}

      {/* Alta */}
      {abierto && (
        <div className="rounded-xl bg-club-dorado/5 border border-club-dorado/20 p-3 space-y-3">
          <CuponForm
            mensajeInicial={`¡Gracias ${socioNombre.split(' ')[0]} por este tiempo con nosotros! Que lo disfrutes.`}
            onChange={setDatos}
          />
          <p className="text-muted-foreground text-[11px]">
            El socio lo ve al entrar y lo aplica desde el carrito. Un cupón por pedido, y el pedido tiene que llevar flores.
          </p>
          <div className="flex justify-end">
            <button onClick={handleCrear} disabled={pending} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Crear cupón
            </button>
          </div>
        </div>
      )}

      {/* Listado */}
      {cupones === null ? (
        <p className="text-xs text-muted-foreground italic">Cargando…</p>
      ) : cupones.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin cupones.</p>
      ) : (
        <div className="space-y-2">
          {cupones.map(c => (
            <div key={c.id} className="rounded-xl bg-white/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {labelCupon(c)}
                  {c.lote_id && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(para todos)</span>}
                </p>
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] border', ESTADO_BADGE[c.estado])}>
                  {c.estado === 'disponible' ? 'Disponible' : c.estado === 'usado' ? 'Usado' : 'Anulado'}
                </span>
              </div>
              <p className="text-muted-foreground text-xs whitespace-pre-wrap">{c.mensaje}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Creado {formatFecha(c.created_at)}
                  {c.vence_at && <> · vence {formatFecha(c.vence_at)}</>}
                  {c.usado_at && <> · usado {formatFecha(c.usado_at)}</>}
                  {c.visto_at && c.estado === 'disponible' && <> · <Check className="w-3 h-3 inline" /> visto</>}
                </span>
                {c.estado === 'disponible' && (
                  <button onClick={() => handleAnular(c.id)} disabled={pending}
                    className="flex items-center gap-1 text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50">
                    <Ban className="w-3 h-3" /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
