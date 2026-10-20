'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, X, Loader2, Package, Check } from 'lucide-react';
import { crearPedidoManual } from '@/app/actions/pedidos';
import { cn, formatGramos, formatPrecio, formatNumeroPedido, labelTipo } from '@/lib/utils';
import { nombrePedido, type PedidoAdmin, type GeneticaDisponible } from './AdminPedidosClient';

// ============================================================
// Pedido manual: lo carga un admin para alguien sin cuenta
// ============================================================
export function PedidoManualModal({ geneticas, onClose }: { geneticas: GeneticaDisponible[]; onClose: () => void }) {
  const router = useRouter();
  const [gramos, setGramos] = useState<Record<string, string>>({});
  const [total, setTotal] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = geneticas
    .map(g => ({ id: g.genetica_id, cantidad: parseFloat(gramos[g.genetica_id] || '0') || 0, g }))
    .filter(i => i.cantidad > 0);
  const totalGramos = items.reduce((a, i) => a + i.cantidad, 0);
  // Sugerencia a precio de lista; el admin pone el total real (puede ser promo)
  const sugerido = items.reduce((a, i) => a + i.cantidad * (i.g.precio_gramo ?? 0), 0);
  const excede = items.some(i => i.cantidad > i.g.stock_total_gramos);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = await crearPedidoManual({
      items: items.map(i => ({ id: i.id, cantidad: i.cantidad })),
      total: parseFloat(total) || 0, cliente_nombre: nombre, cliente_direccion: direccion, notas,
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
    router.refresh();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><Plus className="w-5 h-5 text-club-dorado" /> Pedido manual</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-muted-foreground text-xs">
          Para alguien sin cuenta. Entra como pendiente y sigue el flujo normal; al aprobarlo descuenta stock y el total entra a Tesorería.
          No pide comprobante adjunto: marcá &quot;Comprobante chequeado&quot; cuando lo cobres.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-foreground/70 font-medium">Genéticas y gramos</p>
            {geneticas.length === 0 && <p className="text-muted-foreground text-xs">No hay genéticas con stock disponible.</p>}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {geneticas.map(g => {
                const v = parseFloat(gramos[g.genetica_id] || '0') || 0;
                return (
                  <div key={g.genetica_id} className={cn('flex items-center gap-3 px-3 py-2 rounded-xl border', v > 0 ? 'bg-club-dorado/10 border-club-dorado/40' : 'bg-white/5 border-white/10')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium truncate">{g.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {labelTipo(g.tipo)} · disponible {formatGramos(g.stock_total_gramos)}{g.precio_gramo != null && <> · {formatPrecio(g.precio_gramo)}/g</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input type="number" min="0" step="5" value={gramos[g.genetica_id] ?? ''} onChange={e => setGramos(s => ({ ...s, [g.genetica_id]: e.target.value }))}
                        className={cn('input-club w-20 py-1.5 text-sm text-center', v > g.stock_total_gramos && '!border-red-500/60')} placeholder="0" />
                      <span className="text-xs text-muted-foreground">g</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {excede && <p className="text-red-400 text-xs">Hay una genética con más gramos que el stock disponible.</p>}
          </div>

          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Total del pedido en $ *</label>
            <div className="flex items-center gap-3">
              <input type="number" min="0" step="1" value={total} onChange={e => setTotal(e.target.value)} className="input-club w-44 text-lg font-bold text-club-dorado" placeholder="0" required />
              {sugerido > 0 && (
                <button type="button" onClick={() => setTotal(String(Math.round(sugerido)))} className="text-xs text-club-dorado hover:text-club-dorado/80">
                  Usar precio de lista: {formatPrecio(sugerido)}
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] mt-1">{totalGramos > 0 ? `${formatGramos(totalGramos)} en total. ` : ''}Podés poner un total promocional.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Nombre de quien pide</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-club w-full" placeholder="Opcional" />
            </div>
            <div>
              <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Dirección</label>
              <input value={direccion} onChange={e => setDireccion(e.target.value)} className="input-club w-full" placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} className="input-club w-full" placeholder="Opcional" />
          </div>

          {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button type="submit" disabled={pending || items.length === 0 || excede} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear pedido'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Armado en bolsas de hasta 30 g, lo más parejas posible y en múltiplos de 10
//   40 → 20+20 · 50 → 30+20 · 60 → 30+30 · 70 → 30+20+20
// ============================================================
const BOLSA_MAX = 30;
export function bolsasDe(gramos: number): number[] {
  if (gramos <= 0) return [];
  if (gramos <= BOLSA_MAX) return [gramos];
  const n = Math.ceil(gramos / BOLSA_MAX);
  // Base pareja redondeada a múltiplos de 10; el resto se reparte de a 10 en las primeras bolsas
  const base = Math.floor(gramos / n / 10) * 10;
  let resto = gramos - base * n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const extra = Math.min(resto, BOLSA_MAX - base);
    out.push(base + extra);
    resto -= extra;
  }
  // Si quedó resto (gramos no múltiplos de 10), va a la última bolsa
  if (resto > 0) out[out.length - 1] += resto;
  return out;
}

export function BolsasModal({ pedidos, onClose }: { pedidos: PedidoAdmin[]; onClose: () => void }) {
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setHechas(prev => { const s = new Set(prev); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  // Solo flores (los productos no se embolsan)
  const porPedido = pedidos.map(p => ({
    pedido: p,
    bolsas: p.pedido_items
      .filter(i => i.geneticas && (i.cantidad_gramos ?? 0) > 0)
      .flatMap(i => bolsasDe(i.cantidad_gramos ?? 0).map((g, idx) => ({ key: `${p.id}:${i.id}:${idx}`, genetica: i.geneticas!.nombre, gramos: g }))),
  })).filter(x => x.bolsas.length > 0);

  // Total de bolsas por genética, para pesar de corrido
  const resumen = new Map<string, { bolsas: number; gramos: number }>();
  for (const x of porPedido) for (const b of x.bolsas) {
    const r = resumen.get(b.genetica) ?? { bolsas: 0, gramos: 0 };
    r.bolsas += 1; r.gramos += b.gramos; resumen.set(b.genetica, r);
  }
  const totalBolsas = porPedido.reduce((a, x) => a + x.bolsas.length, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><Package className="w-5 h-5 text-club-dorado" /> Armar en bolsas</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-muted-foreground text-xs">
          Bolsas de hasta {BOLSA_MAX} g, lo más parejas posible. Cada genética va en su propia bolsa. {hechas.size}/{totalBolsas} tildadas.
        </p>

        {/* Resumen para pesar de corrido */}
        {resumen.size > 0 && (
          <div className="rounded-xl bg-club-dorado/5 border border-club-dorado/20 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {Array.from(resumen.entries()).map(([g, r]) => (
              <span key={g} className="text-foreground"><span className="font-semibold">{g}</span>: {r.bolsas} bolsa{r.bolsas === 1 ? '' : 's'} · {formatGramos(r.gramos)}</span>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {porPedido.map(({ pedido, bolsas }) => {
            const listas = bolsas.filter(b => hechas.has(b.key)).length;
            return (
              <div key={pedido.id} className={cn('rounded-xl border p-3 space-y-2', listas === bolsas.length ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 bg-white/5')}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-semibold">
                    <span className="text-club-dorado">{formatNumeroPedido(pedido.numero)}</span> · {nombrePedido(pedido)}
                  </p>
                  <span className="text-xs text-muted-foreground">{listas}/{bolsas.length} bolsa{bolsas.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {bolsas.map((b, i) => {
                    const ok = hechas.has(b.key);
                    return (
                      <button key={b.key} type="button" onClick={() => toggle(b.key)}
                        className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all',
                          ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-club-verde border-club-verde-claro/30 hover:border-club-dorado/40')}>
                        <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', ok ? 'bg-emerald-500 border-emerald-500' : 'border-white/30')}>
                          {ok && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                        <span className={cn('shrink-0 min-w-[3.5rem] text-center px-2 py-0.5 rounded-md font-bold tabular-nums', ok ? 'text-emerald-300' : 'text-club-dorado bg-club-dorado/15')}>
                          {b.gramos} g
                        </span>
                        <span className={cn('text-sm truncate', ok ? 'text-muted-foreground line-through' : 'text-foreground')}>{b.genetica}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">bolsa {i + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {porPedido.length === 0 && <p className="text-muted-foreground text-sm py-6 text-center">No hay flores para embolsar en los pedidos por armar.</p>}
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary px-5 py-2.5 text-sm">Listo</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
