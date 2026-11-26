'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, Leaf, Target, X } from 'lucide-react';
import { cn, formatGramos, formatPrecio } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { FinanzasTabs } from '../FinanzasTabs';
import { cambiarReponer } from '@/app/actions/personal';
import type { Objetivos, resumenObjetivos } from '@/lib/objetivos';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const COLOR = { verde: 'text-emerald-400', amarillo: 'text-amber-300', rojo: 'text-red-400' };
const BORDE = { verde: 'border-emerald-400/60', amarillo: 'border-amber-300/60', rojo: 'border-red-400/60' };
const pesos = (n: number) => formatPrecio(Math.round(n));
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ObjetivosClient({ objetivos: o, resumen }: { objetivos: Objetivos | null; resumen: ReturnType<typeof resumenObjetivos> | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const alternar = (id: string, reponer: boolean) => startTransition(async () => {
    const r = await cambiarReponer(id, reponer);
    setError(r.ok ? null : r.error);
    router.refresh();
  });

  const hayUsd = o != null && (o.usd.necesario > 0 || o.usd.disponible > 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<Target className="w-5 h-5" />} title="Gestión y finanzas" subtitle="Objetivos: cuánta plata hay que juntar · solo superadmin" />
      <FinanzasTabs />

      {error && <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
      {!o || !resumen ? (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">No se pudieron cargar los objetivos. ¿Se ejecutó gastos-fijos-moneda.sql en Supabase?</p></motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <motion.div variants={fadeUp} className={cn('glass-card p-5 border-l-4', BORDE[resumen.color])}>
              <p className="text-muted-foreground text-xs mb-1">Hay que juntar</p>
              <p className="text-foreground font-bold text-2xl">{pesos(o.necesario)}</p>
              {hayUsd && <p className="text-foreground font-bold text-lg">{usd(o.usd.necesario)}</p>}
              <p className={cn('text-sm font-semibold mt-1', COLOR[resumen.color])}>
                {resumen.color === 'verde' ? 'Alcanza con lo que hay' : resumen.color === 'amarillo' ? 'Alcanza si se cobran los pendientes'
                  : resumen.faltaUsd > 0 && resumen.faltaReal === 0 ? 'Faltan dólares' : 'No alcanza'}
              </p>
            </motion.div>
            <Disponible titulo="Real" monto={o.real} falta={resumen.faltaReal} sobra={o.real - o.necesario} dolares={hayUsd ? o.usd : null} />
            <Disponible titulo="Potencial" monto={o.real + o.pendientes.monto} falta={resumen.faltaPotencial} dolares={hayUsd ? o.usd : null}
              sobra={o.real + o.pendientes.monto - o.necesario - o.pendientes.reponer}
              nota={`${o.pendientes.pedidos} pedido${o.pendientes.pedidos === 1 ? '' : 's'} pendiente${o.pendientes.pedidos === 1 ? '' : 's'}. Reponerlos cuesta ${pesos(o.pendientes.reponer)}.`} />
          </div>

          <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/15">
            <Grupo titulo="Reponer stock" total={o.reponer} detalle={[]} nota="Gramos vendidos de lotes con costo, al último costo. Detalle abajo" />
            <Grupo titulo="Próximos sueldos" total={o.sueldos.total} detalle={o.sueldos.detalle} nota="Menos retiros y pagos hechos" />
            <Grupo titulo="Reserva de aguinaldo" total={o.aguinaldo.total} detalle={o.aguinaldo.detalle} nota="Se junta de a poco; entero desde el mes anterior al pago" />
            <Grupo titulo="Gastos fijos" total={o.fijos.total} detalle={o.fijos.detalle} nota="Tareas mensuales de Gestión con monto, hasta fin del mes que viene" />
          </motion.div>

          {hayUsd && (
            <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/15">
              <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span className="text-foreground">Hay que juntar en dólares <b className="tabular-nums">{usd(o.usd.necesario)}</b></span>
                <span className="text-foreground">Disponible <b className="tabular-nums">{usd(o.usd.disponible)}</b></span>
                {o.usd.necesario > o.usd.disponible && <span className="text-red-400 font-semibold">Faltan {usd(o.usd.necesario - o.usd.disponible)}</span>}
              </div>
              <Grupo titulo="Gastos fijos" total={o.usd.fijos.total} detalle={o.usd.fijos.detalle} formato={usd} />
            </motion.div>
          )}

          <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
            <h3 className="font-avigea text-base text-foreground flex items-center gap-2"><Leaf className="w-4 h-4 text-club-dorado" /> Reposición por genética</h3>
            {o.reposicion.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">Todavía no hay ingresos con costo. Los lotes ya cargados no cuentan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
                      {['Cuenta', 'Genética', 'Gramos', 'Último costo', 'Total'].map((h, i) => <th key={h} className={cn('py-2 pr-3 font-semibold', i < 2 ? 'text-left' : 'text-right')}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-club-verde-claro/10 tabular-nums">
                    {o.reposicion.map(r => (
                      <tr key={r.genetica_id} className={cn(!r.reponer && 'opacity-50')}>
                        <td className="py-2"><input type="checkbox" checked={r.reponer} disabled={pending} onChange={e => alternar(r.genetica_id, e.target.checked)} title="Incluir en la reposición" /></td>
                        <td className="py-2 text-foreground">{r.nombre}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{formatGramos(r.gramos)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{formatPrecio(r.costo)}</td>
                        <td className="py-2 pr-3 text-right text-club-dorado font-semibold">{pesos(r.gramos * r.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function Disponible({ titulo, monto, falta, sobra, nota, dolares }: { dolares: Objetivos['usd'] | null; titulo: string; monto: number; falta: number; sobra: number; nota?: string }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <p className="text-muted-foreground text-xs mb-1">{titulo}</p>
      <p className="text-foreground font-bold text-2xl">{pesos(monto)}</p>
      <p className={cn('text-sm font-semibold mt-1', falta > 0 ? 'text-red-400' : 'text-emerald-400')}>{falta > 0 ? `Faltan ${pesos(falta)}` : `Sobran ${pesos(sobra)}`}</p>
      {dolares && (
        <>
          <p className="text-foreground font-bold text-lg mt-2">{usd(dolares.disponible)}</p>
          <p className={cn('text-sm font-semibold', dolares.necesario > dolares.disponible ? 'text-red-400' : 'text-emerald-400')}>
            {dolares.necesario > dolares.disponible ? 'Faltan' : 'Sobran'} {usd(Math.abs(dolares.disponible - dolares.necesario))}
          </p>
        </>
      )}
      {nota && <p className="text-[11px] text-muted-foreground mt-1">{nota}</p>}
    </motion.div>
  );
}

function Grupo({ titulo, total, detalle, nota, formato = pesos }: { formato?: (n: number) => string; titulo: string; total: number; detalle: { nombre: string; monto: number }[]; nota?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="px-5 py-3">
      <button onClick={() => setAbierto(v => !v)} disabled={detalle.length === 0} className="w-full flex items-center gap-3 text-left">
        <span className="flex-1">
          <span className="text-foreground text-sm font-medium block">{titulo}</span>
          {nota && <span className="text-muted-foreground text-xs">{nota}</span>}
        </span>
        <span className="text-foreground font-bold tabular-nums">{formato(total)}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', abierto && 'rotate-180', detalle.length === 0 && 'invisible')} />
      </button>
      {abierto && detalle.map((d, i) => (
        <p key={i} className="flex justify-between text-xs text-muted-foreground pt-1.5 pr-7"><span>{d.nombre}</span><span className="tabular-nums">{formato(d.monto)}</span></p>
      ))}
    </div>
  );
}
