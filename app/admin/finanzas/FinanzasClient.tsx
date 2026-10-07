'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Wallet, Loader2, Leaf, ShoppingBag, Receipt, BadgePercent, Truck, Users, ChevronDown, Download, AlertTriangle, Package,
} from 'lucide-react';
import { cn, formatFecha, formatGramos, formatPrecio, formatNumeroPedido } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import type { FinanzasClub } from '@/lib/types/database';
import type { AgrupacionFin, FiltroEstados } from './page';

// Colores de la marca sobre fondo verde oscuro (mismos que Estadísticas)
const DORADO = '#F3A707';
const GRID   = 'rgba(255,255,255,0.08)';
const EJE    = 'rgba(255,255,255,0.45)';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function hoyISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function presets(): { label: string; desde: string; hasta: string }[] {
  const hoy = new Date();
  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesAnt    = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
  const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
  return [
    { label: 'Este mes',   desde: hoyISO(inicioMes),    hasta: hoyISO(hoy) },
    { label: 'Mes pasado', desde: hoyISO(inicioMesAnt), hasta: hoyISO(finMesAnt) },
    { label: 'Últimos 30', desde: hoyISO(hace30),       hasta: hoyISO(hoy) },
    { label: 'Últimos 90', desde: hoyISO(hace90),       hasta: hoyISO(hoy) },
    { label: 'Este año',   desde: hoyISO(inicioAnio),   hasta: hoyISO(hoy) },
  ];
}

const ESTADOS_LABEL: Record<FiltroEstados, string> = {
  cobrados:   'Aprobados y entregados',
  entregados: 'Solo entregados',
  todos:      'Todos (incl. pendientes)',
};

function labelPeriodo(iso: string, g: AgrupacionFin) {
  return formatFecha(iso, g === 'month' ? 'MMM yyyy' : 'dd MMM');
}

// Exportar una tabla a CSV (separador ; para que Excel en español lo abra directo)
function descargarCSV(nombre: string, filas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenido = '﻿' + filas.map(f => f.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

// Tooltip oscuro estilo club
function TooltipClub({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-club-verde-claro/40 bg-club-verde px-3.5 py-2.5 shadow-club-md text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="text-foreground font-semibold">{formatPrecio(payload[0].value)}</p>
      {payload[0].payload.pedidos != null && (
        <p className="text-muted-foreground text-xs">{payload[0].payload.pedidos} pedido{payload[0].payload.pedidos === 1 ? '' : 's'}</p>
      )}
    </div>
  );
}

function Kpi({ icono, label, valor, sub }: { icono: React.ReactNode; label: string; valor: string; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
        <span className="text-club-dorado">{icono}</span> {label}
      </div>
      <p className="text-foreground font-bold text-xl leading-tight">{valor}</p>
      {sub && <p className="text-muted-foreground text-[11px] mt-0.5">{sub}</p>}
    </motion.div>
  );
}

interface Props {
  datos:         FinanzasClub | null;
  desde:         string;
  hasta:         string;
  agrupacion:    AgrupacionFin;
  filtroEstados: FiltroEstados;
  errorMsg:      string | null;
}

export function FinanzasClient({ datos, desde: desdeInicial, hasta: hastaInicial, agrupacion, filtroEstados, errorMsg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [socioAbierto, setSocioAbierto] = useState<string | null>(null);

  const navegar = (p: { desde?: string; hasta?: string; g?: AgrupacionFin; estados?: FiltroEstados }) => {
    const q = new URLSearchParams({
      desde:   p.desde   ?? desde,
      hasta:   p.hasta   ?? hasta,
      g:       p.g       ?? agrupacion,
      estados: p.estados ?? filtroEstados,
    });
    startTransition(() => router.push(`/admin/finanzas?${q.toString()}`));
  };

  const serie = useMemo(() => (datos?.serie ?? []).map(s => ({
    label: labelPeriodo(s.periodo, agrupacion), ingresos: s.ingresos, pedidos: s.pedidos,
  })), [datos, agrupacion]);

  const r = datos?.resumen;
  const brutoFlores = (datos?.por_genetica ?? []).reduce((a, g) => a + g.bruto, 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        icon={<Wallet className="w-5 h-5" />}
        title="Finanzas"
        subtitle="Ingresos, gramos y detalle por genética, socio y pedido · solo superadmin"
      />

      {/* Filtros: período, agrupación y qué pedidos contar */}
      <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {presets().map(p => (
              <button key={p.label} onClick={() => { setDesde(p.desde); setHasta(p.hasta); navegar({ desde: p.desde, hasta: p.hasta }); }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  desde === p.desde && hasta === p.hasta ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground bg-white/5')}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="input-club py-1.5 text-xs" />
            <span className="text-muted-foreground text-xs">a</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="input-club py-1.5 text-xs" />
            <button onClick={() => navegar({})} disabled={pending}
              className="px-3 py-1.5 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-xs font-semibold hover:bg-club-dorado/25 transition-colors disabled:opacity-50">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 glass-card rounded-lg">
            {(Object.keys(ESTADOS_LABEL) as FiltroEstados[]).map(k => (
              <button key={k} onClick={() => navegar({ estados: k })}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                  filtroEstados === k ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
                {ESTADOS_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 glass-card rounded-lg ml-auto">
            {([['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([v, l]) => (
              <button key={v} onClick={() => navegar({ g: v })}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                  agrupacion === v ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" /> <p className="text-sm">{errorMsg}</p>
        </motion.div>
      )}

      {datos && r && (
        <>
          {/* Avisos de precisión */}
          {(r.estimados > 0 || r.sin_monto > 0) && (
            <motion.div variants={fadeUp} className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                {r.sin_monto > 0 && <>{r.sin_monto} pedido{r.sin_monto === 1 ? '' : 's'} anterior{r.sin_monto === 1 ? '' : 'es'} a agosto no tiene{r.sin_monto === 1 ? '' : 'n'} total guardado y no suma{r.sin_monto === 1 ? '' : 'n'} a los ingresos. </>}
                {r.estimados > 0 && <>El $ por genética de {r.estimados} pedido{r.estimados === 1 ? '' : 's'} está estimado con el precio actual (no se guardaba el precio del momento).</>}
              </p>
            </motion.div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icono={<Wallet className="w-4 h-4" />}       label="Ingresos netos"  valor={formatPrecio(r.ingresos)} sub="lo cobrado, después de descuentos" />
            <Kpi icono={<Leaf className="w-4 h-4" />}         label="Flores"          valor={formatGramos(r.gramos)} sub={r.unidades > 0 ? `+ ${r.unidades} u. de productos` : undefined} />
            <Kpi icono={<ShoppingBag className="w-4 h-4" />}  label="Pedidos"         valor={String(r.pedidos)} />
            <Kpi icono={<Receipt className="w-4 h-4" />}      label="Ticket promedio" valor={formatPrecio(r.ticket_promedio)} />
            <Kpi icono={<BadgePercent className="w-4 h-4" />} label="Descuentos"      valor={formatPrecio(r.descuentos)} sub="por cantidad + cupones" />
            <Kpi icono={<Truck className="w-4 h-4" />}        label="Envíos cobrados" valor={formatPrecio(r.envios)} />
          </div>

          {/* Serie de ingresos */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <h3 className="font-avigea text-base text-foreground mb-4">Ingresos por {agrupacion === 'day' ? 'día' : agrupacion === 'week' ? 'semana' : 'mes'}</h3>
            {serie.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">Sin pedidos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${Math.round(v / 1000)}k`} width={48} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<TooltipClub />} />
                  <Bar dataKey="ingresos" fill={DORADO} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Por genética */}
            <motion.div variants={fadeUp} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-avigea text-base text-foreground">Por genética</h3>
                  <p className="text-muted-foreground text-[11px]">$ bruto: precio × gramos, antes de descuentos. Total bruto flores: {formatPrecio(brutoFlores)}</p>
                </div>
                <button onClick={() => descargarCSV(`finanzas-geneticas-${desde}-${hasta}.csv`, [
                  ['Genética', 'Gramos', '$ bruto', '% del bruto', 'Pedidos', 'Estimado'],
                  ...datos.por_genetica.map(g => [g.nombre, g.gramos, g.bruto, brutoFlores > 0 ? Math.round(g.bruto / brutoFlores * 1000) / 10 : 0, g.pedidos, g.estimado ? 'sí' : 'no']),
                ])} className="text-xs text-club-dorado hover:text-club-dorado/80 inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              {datos.por_genetica.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sin flores en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
                        <th className="text-left py-2 font-semibold">Genética</th>
                        <th className="text-right py-2 font-semibold">Gramos</th>
                        <th className="text-right py-2 font-semibold">$ bruto</th>
                        <th className="text-right py-2 font-semibold">%</th>
                        <th className="text-right py-2 font-semibold">Pedidos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-club-verde-claro/10">
                      {datos.por_genetica.map(g => (
                        <tr key={g.nombre}>
                          <td className="py-2 text-foreground font-medium">{g.nombre}{g.estimado && <span className="text-amber-300/80 text-[10px] ml-1" title="Incluye pedidos con precio estimado">≈</span>}</td>
                          <td className="py-2 text-right text-foreground">{formatGramos(g.gramos)}</td>
                          <td className="py-2 text-right text-club-dorado font-semibold">{formatPrecio(g.bruto)}</td>
                          <td className="py-2 text-right text-muted-foreground">{brutoFlores > 0 ? `${Math.round(g.bruto / brutoFlores * 100)}%` : '—'}</td>
                          <td className="py-2 text-right text-muted-foreground">{g.pedidos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {datos.por_producto.length > 0 && (
                <div className="mt-5 pt-4 border-t border-club-verde-claro/20">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Productos</h4>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-club-verde-claro/10">
                      {datos.por_producto.map(p => (
                        <tr key={p.nombre}>
                          <td className="py-1.5 text-foreground">{p.nombre}</td>
                          <td className="py-1.5 text-right text-foreground">{p.unidades} u.</td>
                          <td className="py-1.5 text-right text-club-dorado font-semibold">{formatPrecio(p.bruto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Por socio */}
            <motion.div variants={fadeUp} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-avigea text-base text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-club-dorado" /> Por socio</h3>
                  <p className="text-muted-foreground text-[11px]">Tocá un socio para ver qué genéticas pidió</p>
                </div>
                <button onClick={() => descargarCSV(`finanzas-socios-${desde}-${hasta}.csv`, [
                  ['Socio', 'Genética', 'Gramos', '$ bruto', 'Pedidos del socio', 'Gramos del socio', '$ pagado por el socio'],
                  ...datos.por_socio.flatMap(s => s.detalle.length
                    ? s.detalle.map(d => [s.nombre, d.nombre, d.gramos, d.bruto, s.pedidos, s.gramos, s.total])
                    : [[s.nombre, '', 0, 0, s.pedidos, s.gramos, s.total]]),
                ])} className="text-xs text-club-dorado hover:text-club-dorado/80 inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              {datos.por_socio.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sin pedidos en el período.</p>
              ) : (
                <div className="divide-y divide-club-verde-claro/10">
                  {datos.por_socio.map(s => {
                    const abierto = socioAbierto === s.socio_id;
                    return (
                      <div key={s.socio_id}>
                        <button onClick={() => setSocioAbierto(abierto ? null : s.socio_id)}
                          className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-white/5 rounded-lg px-1 transition-colors">
                          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', abierto && 'rotate-180')} />
                          <span className="flex-1 min-w-0 text-sm text-foreground font-medium truncate">{s.nombre}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{s.pedidos} ped.</span>
                          <span className="text-xs text-foreground shrink-0 w-16 text-right">{formatGramos(s.gramos)}</span>
                          <span className="text-sm text-club-dorado font-semibold shrink-0 w-24 text-right">{formatPrecio(s.total)}</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {abierto && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="pl-8 pr-2 pb-3 space-y-1">
                                {s.detalle.length === 0 && <p className="text-xs text-muted-foreground italic">Solo productos, sin flores.</p>}
                                {s.detalle.map(d => (
                                  <div key={d.nombre} className="flex items-center justify-between text-xs">
                                    <span className="text-foreground/80">{d.nombre}</span>
                                    <span className="text-muted-foreground">{formatGramos(d.gramos)} · <span className="text-club-dorado">{formatPrecio(d.bruto)}</span></span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Pedidos del período */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-avigea text-base text-foreground">Pedidos del período</h3>
              <button onClick={() => descargarCSV(`finanzas-pedidos-${desde}-${hasta}.csv`, [
                ['Fecha', 'Nº', 'Socio', 'Estado', 'Gramos', 'Unidades', 'Descuentos', 'Envío', 'Total'],
                ...datos.pedidos.map(p => [formatFecha(p.fecha, 'dd/MM/yyyy'), p.numero, p.socio, p.estado, p.gramos, p.unidades, p.descuentos, p.envio, p.total ?? '']),
              ])} className="text-xs text-club-dorado hover:text-club-dorado/80 inline-flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            {datos.pedidos.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sin pedidos en el período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
                      <th className="text-left py-2 font-semibold">Fecha</th>
                      <th className="text-left py-2 font-semibold">Pedido</th>
                      <th className="text-left py-2 font-semibold">Socio</th>
                      <th className="text-right py-2 font-semibold">Flores</th>
                      <th className="text-right py-2 font-semibold">Desc.</th>
                      <th className="text-right py-2 font-semibold">Envío</th>
                      <th className="text-right py-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-club-verde-claro/10">
                    {datos.pedidos.map(p => (
                      <tr key={p.id}>
                        <td className="py-2 text-muted-foreground whitespace-nowrap">{formatFecha(p.fecha, 'dd MMM')}</td>
                        <td className="py-2">
                          <Link href="/admin/pedidos?filtro=todos" className="text-club-dorado hover:underline">{formatNumeroPedido(p.numero)}</Link>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{p.estado}</span>
                        </td>
                        <td className="py-2 text-foreground truncate max-w-[180px]">{p.socio}</td>
                        <td className="py-2 text-right text-foreground">{p.gramos > 0 ? formatGramos(p.gramos) : '—'}{p.unidades > 0 && <span className="text-muted-foreground text-xs"> +{p.unidades}u</span>}</td>
                        <td className="py-2 text-right text-emerald-400">{p.descuentos > 0 ? `−${formatPrecio(p.descuentos)}` : '—'}</td>
                        <td className="py-2 text-right text-muted-foreground">{p.envio > 0 ? formatPrecio(p.envio) : '—'}</td>
                        <td className="py-2 text-right text-club-dorado font-semibold">{p.total != null ? formatPrecio(p.total) : <span className="text-muted-foreground text-xs">sin monto</span>}</td>
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
