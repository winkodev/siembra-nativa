'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, ChevronDown, Loader2, Scale } from 'lucide-react';
import { cn, formatFecha, formatPrecio } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { FinanzasTabs } from '../FinanzasTabs';
import { presets } from '../FinanzasClient';

export interface MovBalance {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  moneda: 'ARS' | 'USD';
  monto: number;
  concepto: string;
  categoria: string;
}

// Entró y salió con el verde y rojo de Finanzas. Categorías: colores validados sobre el fondo verde (#083D3A)
const ENTRO = '#34d399';  // emerald-400, el verde de Finanzas
const SALIO = '#f87171';  // red-400, el rojo de Finanzas
const SERIES = ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef'];
const OTROS = '#7d8f8c';
const FONDO = '#083D3A';
const GRID = 'rgba(255,255,255,0.08)';
const EJE = 'rgba(255,255,255,0.45)';
const MAX_CATEGORIAS = SERIES.length;

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

type Moneda = 'ARS' | 'USD';
const dinero = (moneda: Moneda, n: number) => moneda === 'USD'
  ? `US$ ${Math.round(n).toLocaleString('es-AR')}`
  : formatPrecio(Math.round(n));
const corto = (moneda: Moneda, n: number) => `${moneda === 'USD' ? 'US$' : '$'}${Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : `${Math.round(n / 1000)}k`}`;

// Meses entre dos fechas, inclusive: ['2026-01', ...]
function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.slice(0, 7).split('-').map(Number);
  const fin = hasta.slice(0, 7);
  while (`${y}-${String(m).padStart(2, '0')}` <= fin && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

// Total por categoría, de mayor a menor
function porCategoria(movs: MovBalance[]) {
  const m = new Map<string, MovBalance[]>();
  for (const x of movs) m.set(x.categoria, [...(m.get(x.categoria) ?? []), x]);
  return Array.from(m.entries())
    .map(([nombre, lista]) => ({ nombre, total: lista.reduce((a, x) => a + x.monto, 0), movimientos: lista }))
    .sort((a, b) => b.total - a.total);
}

export function BalanceClient({ movimientos, desde: desdeInicial, hasta: hastaInicial, errorMsg }: {
  movimientos: MovBalance[]; desde: string; hasta: string; errorMsg: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const hayUsd = movimientos.some(m => m.moneda === 'USD');
  const [moneda, setMoneda] = useState<Moneda>('ARS');

  const navegar = (d: string, h: string) => startTransition(() => router.push(`/admin/finanzas/balance?desde=${d}&hasta=${h}`));

  const b = useMemo(() => {
    const movs = movimientos.filter(m => m.moneda === moneda);
    const ingresos = movs.filter(m => m.tipo === 'ingreso');
    const egresos = movs.filter(m => m.tipo === 'egreso');
    const suma = (l: MovBalance[]) => l.reduce((a, m) => a + m.monto, 0);
    const catEgresos = porCategoria(egresos);
    // Las categorías más grandes llevan color; el resto se agrupa en "Otros"
    const conColor = catEgresos.slice(0, catEgresos.length > MAX_CATEGORIAS ? MAX_CATEGORIAS - 1 : MAX_CATEGORIAS).map(c => c.nombre);
    const hayOtros = catEgresos.length > conColor.length;
    const meses = mesesEntre(desdeInicial, hastaInicial).map(mes => {
      const delMes = movs.filter(m => m.fecha.startsWith(mes));
      const fila: Record<string, number | string> = {
        mes, label: formatFecha(`${mes}-01`, 'MMM yy'),
        entro: suma(delMes.filter(m => m.tipo === 'ingreso')), salio: suma(delMes.filter(m => m.tipo === 'egreso')),
      };
      return fila;
    });
    return {
      entro: suma(ingresos), salio: suma(egresos), meses,
      catIngresos: porCategoria(ingresos), catEgresos,
      // Porciones de la torta: las categorías con color y el resto junto en "Otros"
      torta: [
        ...catEgresos.filter(c => conColor.includes(c.nombre)).map(c => ({ nombre: c.nombre, total: c.total })),
        ...(hayOtros ? [{ nombre: 'Otros', total: catEgresos.filter(c => !conColor.includes(c.nombre)).reduce((a, c) => a + c.total, 0) }] : []),
      ],
      series: [...conColor.map((c, i) => ({ nombre: c, color: SERIES[i] })), ...(hayOtros ? [{ nombre: 'Otros', color: OTROS }] : [])],
    };
  }, [movimientos, moneda, desdeInicial, hastaInicial]);

  const resultado = b.entro - b.salio;
  const colorDe = (nombre: string) => b.series.find(s => s.nombre === nombre)?.color ?? OTROS;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<Scale className="w-5 h-5" />} title="Gestión y finanzas" subtitle="Balance: cuánto entró y cuánto salió · solo superadmin" />
      <FinanzasTabs />

      {/* Filtros en una fila: período y moneda */}
      <motion.div variants={fadeUp} className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {presets().map(p => (
            <button key={p.label} onClick={() => { setDesde(p.desde); setHasta(p.hasta); navegar(p.desde, p.hasta); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                desde === p.desde && hasta === p.hasta ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground bg-white/5')}>
              {p.label}
            </button>
          ))}
        </div>
        {hayUsd && (
          <div className="flex gap-1 p-1 glass-card rounded-lg">
            {(['ARS', 'USD'] as const).map(k => (
              <button key={k} onClick={() => setMoneda(k)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', moneda === k ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
                {k === 'ARS' ? 'Pesos' : 'Dólares'}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="input-club py-1.5 text-xs" />
          <span className="text-muted-foreground text-xs">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="input-club py-1.5 text-xs" />
          <button onClick={() => navegar(desde, hasta)} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-xs font-semibold hover:bg-club-dorado/25 transition-colors disabled:opacity-50">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
          </button>
        </div>
      </motion.div>

      {errorMsg ? (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{errorMsg}</p></motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Total icono={<ArrowDownCircle className="w-4 h-4" />} label="Entró" valor={dinero(moneda, b.entro)} />
            <Total icono={<ArrowUpCircle className="w-4 h-4" />} label="Salió" valor={dinero(moneda, b.salio)} />
            <Total icono={<Scale className="w-4 h-4" />} label="Resultado" valor={`${resultado < 0 ? '−' : resultado > 0 ? '+' : ''}${dinero(moneda, Math.abs(resultado))}`}
              color={resultado < 0 ? 'text-red-400' : 'text-emerald-400'} sub={resultado < 0 ? 'Salió más de lo que entró' : 'Entró más de lo que salió'} />
          </div>

          <motion.div variants={fadeUp} className="glass-card p-5">
            <Titulo texto="Entradas y salidas por mes" leyenda={[{ nombre: 'Entró', color: ENTRO }, { nombre: 'Salió', color: SALIO }]} />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={b.meses} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => corto(moneda, v)} width={56} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<TooltipBalance moneda={moneda} />} />
                <Bar dataKey="entro" name="Entró" fill={ENTRO} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="salio" name="Salió" fill={SALIO} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div variants={fadeUp} className="glass-card p-5">
            <Titulo texto="En qué se fue la plata" leyenda={b.series} />
            {b.salio === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">Sin salidas en el período.</p>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Tooltip content={<TooltipTorta moneda={moneda} total={b.salio} />} />
                    {/* Borde del color del fondo: separa las porciones */}
                    <Pie data={b.torta} dataKey="total" nameKey="nombre" innerRadius="58%" outerRadius="90%" startAngle={90} endAngle={-270}
                      stroke={FONDO} strokeWidth={2} isAnimationActive={false}>
                      {b.torta.map(t => <Cell key={t.nombre} fill={colorDe(t.nombre)} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Total en el centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-muted-foreground text-xs">Salió</span>
                  <span className="text-foreground font-bold text-lg tabular-nums">{dinero(moneda, b.salio)}</span>
                </div>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Composicion titulo="En qué se fue" moneda={moneda} total={b.salio} categorias={b.catEgresos} colorDe={colorDe} />
            <Composicion titulo="De dónde entró" moneda={moneda} total={b.entro} categorias={b.catIngresos} colorDe={() => ENTRO} />
          </div>
          <p className="text-muted-foreground text-[11px]">
            Sale de los movimientos de Tesorería. No cuentan transferencias entre cuentas, compra o venta de dólares ni saldos iniciales.
          </p>
        </>
      )}
    </motion.div>
  );
}

function Total({ icono, label, valor, color, sub }: { icono: React.ReactNode; label: string; valor: string; color?: string; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5"><span className="text-club-dorado">{icono}</span> {label}</div>
      <p className={cn('font-bold text-2xl tabular-nums', color ?? 'text-foreground')}>{valor}</p>
      {sub && <p className="text-muted-foreground text-[11px] mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function Titulo({ texto, leyenda }: { texto: string; leyenda: { nombre: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-3">
      <h3 className="font-avigea text-base text-foreground">{texto}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {leyenda.map(l => (
          <span key={l.nombre} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} /> {l.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

// Tooltip de barras: cada serie con su monto
function TooltipBalance({ active, payload, label, moneda }: any) {
  if (!active || !payload?.length) return null;
  const filas = (payload as { name: string; value: number; color: string }[]).filter(p => p.value > 0);
  return (
    <div className="rounded-xl border border-club-verde-claro/40 bg-club-verde px-3.5 py-2.5 shadow-club-md text-xs space-y-1 min-w-[180px]">
      <p className="text-muted-foreground mb-1 capitalize">{label}</p>
      {filas.length === 0 && <p className="text-muted-foreground">Sin movimientos</p>}
      {[...filas].reverse().map(p => (
        <p key={p.name} className="flex items-center gap-2 text-foreground">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span><span className="tabular-nums font-semibold">{dinero(moneda, p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// Tooltip de la torta: categoría, monto y porcentaje
function TooltipTorta({ active, payload, moneda, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-club-verde-claro/40 bg-club-verde px-3.5 py-2.5 shadow-club-md text-xs">
      <p className="flex items-center gap-2 text-foreground font-semibold">
        <span className="w-2 h-2 rounded-sm" style={{ background: p.payload.fill }} /> {p.name}
      </p>
      <p className="text-foreground tabular-nums">{dinero(moneda, p.value)} · {total > 0 ? ((p.value / total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : 0}%</p>
    </div>
  );
}

// Tabla por categoría: monto, porcentaje y, al tocarla, sus movimientos
function Composicion({ titulo, moneda, total, categorias, colorDe }: {
  titulo: string; moneda: Moneda; total: number; colorDe: (nombre: string) => string;
  categorias: { nombre: string; total: number; movimientos: MovBalance[] }[];
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <h3 className="font-avigea text-base text-foreground mb-3">{titulo}</h3>
      {categorias.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">Sin movimientos en el período.</p>
      ) : (
        <div className="divide-y divide-club-verde-claro/10">
          {categorias.map(c => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            const abierto = abierta === c.nombre;
            return (
              <div key={c.nombre}>
                <button onClick={() => setAbierta(abierto ? null : c.nombre)} className="w-full py-2.5 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorDe(c.nombre) }} />
                    <span className="flex-1 text-foreground">{c.nombre}</span>
                    <span className="text-muted-foreground text-xs tabular-nums w-12 text-right">{pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span>
                    <span className="text-foreground font-semibold tabular-nums w-28 text-right">{dinero(moneda, c.total)}</span>
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', abierto && 'rotate-180')} />
                  </div>
                  <div className="ml-5 mr-7 mt-1.5 h-1 rounded-full bg-white/5">
                    <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: colorDe(c.nombre) }} />
                  </div>
                </button>
                {abierto && (
                  <div className="ml-5 mr-7 pb-2 space-y-1 max-h-64 overflow-y-auto">
                    {c.movimientos.map(m => (
                      <p key={m.id} className="flex gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums shrink-0">{formatFecha(m.fecha, 'dd/MM')}</span>
                        <span className="flex-1 truncate">{m.concepto}</span>
                        <span className="tabular-nums">{dinero(moneda, m.monto)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
