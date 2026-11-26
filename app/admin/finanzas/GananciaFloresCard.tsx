'use client';

import { useState } from 'react';
import { cn, formatGramos, formatNumeroPedido, formatPrecio } from '@/lib/utils';
import type { GananciaFlores } from '@/lib/types/database';

// Ganancia real de las flores: lo cobrado menos lo que costó cada gramo
export function GananciaFloresCard({ ganancia }: { ganancia: GananciaFlores }) {
  const [vista, setVista] = useState<'geneticas' | 'pedidos'>('geneticas');
  const filas = vista === 'geneticas'
    ? ganancia.geneticas.map(g => ({ k: g.nombre, ...g }))
    : ganancia.pedidos.map(p => ({ k: p.id, nombre: formatNumeroPedido(p.numero), gramos: p.gramos, venta: p.venta, costo: p.costo }));
  const total = filas.reduce((a, f) => ({ gramos: a.gramos + Number(f.gramos), venta: a.venta + Number(f.venta), costo: a.costo + Number(f.costo) }), { gramos: 0, venta: 0, costo: 0 });
  const pesos = (n: number) => formatPrecio(Math.round(n));

  return (
    <div className="glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-avigea text-base text-foreground">Ganancia de flores</h3>
        <div className="flex gap-1">
          {(['geneticas', 'pedidos'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} className={cn('px-3 py-1 rounded-lg text-xs font-semibold', vista === v ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
              {v === 'geneticas' ? 'Por genética' : 'Por pedido'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs mb-3">Solo gramos de lotes con costo cargado. Con descuentos aplicados y sin envío.</p>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
              {['', 'Gramos', 'Venta', 'Costo', 'Ganancia'].map((h, i) => <th key={i} className={cn('py-2 font-semibold', i === 0 ? 'text-left' : 'text-right')}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-club-verde-claro/10 tabular-nums">
            {[...filas, { k: 'total', nombre: 'Total', ...total }].map(f => (
              <tr key={f.k} className={cn(f.k === 'total' && 'font-bold')}>
                <td className="py-2 text-foreground">{f.nombre}</td>
                <td className="py-2 text-right text-muted-foreground">{formatGramos(Number(f.gramos))}</td>
                <td className="py-2 text-right text-foreground">{pesos(Number(f.venta))}</td>
                <td className="py-2 text-right text-muted-foreground">{pesos(Number(f.costo))}</td>
                <td className={cn('py-2 text-right font-semibold', Number(f.venta) >= Number(f.costo) ? 'text-emerald-400' : 'text-red-400')}>{pesos(Number(f.venta) - Number(f.costo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
