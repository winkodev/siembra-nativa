'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  BarChart3, Leaf, ShoppingBag, Users, UserPlus, Package2, Scale, Loader2,
} from 'lucide-react';
import { cn, formatGramos, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import type { EstadisticasClub } from '@/lib/types/database';
import type { Agrupacion } from './page';

// Colores de la marca sobre fondo verde oscuro (validados por contraste)
const DORADO  = '#F3A707';
const ESMERALDA = '#34D399';

const GRID   = 'rgba(255,255,255,0.08)';
const EJE    = 'rgba(255,255,255,0.45)';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

// Presets de rango: [etiqueta, desde, hasta] en fechas locales
function hoyISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function presets(): { label: string; desde: string; hasta: string }[] {
  const hoy = new Date();
  const inicioMes     = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesAnt  = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesAnt     = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const hace30        = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
  const hace90        = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
  const inicioAnio    = new Date(hoy.getFullYear(), 0, 1);
  return [
    { label: 'Este mes',    desde: hoyISO(inicioMes),    hasta: hoyISO(hoy) },
    { label: 'Mes pasado',  desde: hoyISO(inicioMesAnt), hasta: hoyISO(finMesAnt) },
    { label: 'Últimos 30',  desde: hoyISO(hace30),       hasta: hoyISO(hoy) },
    { label: 'Últimos 90',  desde: hoyISO(hace90),       hasta: hoyISO(hoy) },
    { label: 'Este año',    desde: hoyISO(inicioAnio),   hasta: hoyISO(hoy) },
  ];
}

// Etiqueta de un período según la agrupación elegida
function labelPeriodo(iso: string, agrupacion: Agrupacion) {
  return formatFecha(iso, agrupacion === 'month' ? 'MMM yyyy' : 'dd MMM');
}

// Tooltip oscuro estilo club
function TooltipClub({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-club-verde-claro/40 bg-club-verde px-3.5 py-2.5 shadow-club-md text-sm">
      {label && <p className="text-muted-foreground text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-foreground font-semibold">
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

interface Props {
  stats:      EstadisticasClub | null;
  desde:      string;
  hasta:      string;
  agrupacion: Agrupacion;
  errorMsg:   string | null;
}

export function EstadisticasClient({ stats, desde, hasta, agrupacion, errorMsg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navegar = (d: string, h: string, g: Agrupacion) => {
    startTransition(() => {
      router.replace(`/admin/estadisticas?desde=${d}&hasta=${h}&g=${g}`, { scroll: false });
    });
  };

  const listaPresets = useMemo(presets, []);
  const presetActivo = listaPresets.find(p => p.desde === desde && p.hasta === hasta)?.label ?? null;

  const serieDispensado = (stats?.serie_dispensado ?? []).map(s => ({
    ...s, label: labelPeriodo(s.periodo, agrupacion),
  }));
  const serieAltas = (stats?.serie_altas ?? []).map(s => ({
    ...s, label: labelPeriodo(s.periodo, agrupacion),
  }));
  const entregados = stats?.pedidos_por_estado?.entregado ?? 0;
  const promedioGramos = entregados > 0 ? (stats?.gramos_dispensados ?? 0) / entregados : 0;
  const sinDatos = (stats?.pedidos_total ?? 0) === 0 && (stats?.socios_nuevos ?? 0) === 0
    && (stats?.gramos_dispensados ?? 0) === 0;

  const kpis = [
    { icon: Leaf,        label: 'Gramos dispensados',  valor: formatGramos(stats?.gramos_dispensados ?? 0) },
    { icon: Package2,    label: 'Productos entregados', valor: `${stats?.unidades_dispensadas ?? 0} u.` },
    { icon: ShoppingBag, label: 'Pedidos del período',  valor: `${stats?.pedidos_total ?? 0}` },
    { icon: Scale,       label: 'Promedio por entrega', valor: formatGramos(promedioGramos) },
    { icon: UserPlus,    label: 'Socios nuevos',        valor: `${stats?.socios_nuevos ?? 0}` },
    { icon: Users,       label: 'Socios que pidieron',  valor: `${stats?.socios_activos ?? 0}` },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

      <PageHeader
        icon={<BarChart3 className="w-5 h-5" />}
        title="Estadísticas"
        subtitle="Dispensa, pedidos y socios del período"
      />

      {/* Filtros: presets + rango libre + agrupación */}
      <motion.div variants={fadeUp} className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit overflow-x-auto">
          {listaPresets.map(p => (
            <button
              key={p.label}
              onClick={() => navegar(p.desde, p.hasta, agrupacion)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                presetActivo === p.label
                  ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date" value={desde} max={hasta}
            onChange={e => e.target.value && navegar(e.target.value, hasta, agrupacion)}
            className="input-club py-2 text-xs"
            aria-label="Desde"
          />
          <span className="text-muted-foreground text-xs">a</span>
          <input
            type="date" value={hasta} min={desde}
            onChange={e => e.target.value && navegar(desde, e.target.value, agrupacion)}
            className="input-club py-2 text-xs"
            aria-label="Hasta"
          />
          <div className="flex gap-1 p-1 glass-card rounded-xl">
            {([['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([g, label]) => (
              <button
                key={g}
                onClick={() => navegar(desde, hasta, g)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  agrupacion === g
                    ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {pending && <Loader2 className="w-4 h-4 animate-spin text-club-dorado" />}
        </div>
      </motion.div>

      {errorMsg && (
        <motion.div variants={fadeUp} className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {errorMsg}
        </motion.div>
      )}

      {/* KPIs */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="glass-card p-4 flex flex-col gap-1.5">
            <k.icon className="w-4 h-4 text-club-dorado" />
            <p className="text-foreground font-bold text-xl leading-none font-avigea">{k.valor}</p>
            <p className="text-muted-foreground text-xs leading-tight">{k.label}</p>
          </div>
        ))}
      </motion.div>

      {sinDatos && !errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-16 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Sin actividad en el período seleccionado.</p>
        </motion.div>
      )}

      {!sinDatos && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Gramos dispensados en el tiempo */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <h3 className="font-avigea text-base text-foreground mb-4">Gramos dispensados</h3>
            {serieDispensado.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">Sin entregas en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serieDispensado} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<TooltipClub formatter={(v: number) => formatGramos(v)} />} />
                  <Bar dataKey="gramos" fill={DORADO} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Top genéticas */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <h3 className="font-avigea text-base text-foreground mb-4">Genéticas más dispensadas</h3>
            {(stats?.top_geneticas ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">Sin entregas en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats!.top_geneticas} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nombre" width={110} tick={{ fill: EJE, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<TooltipClub formatter={(v: number) => formatGramos(v)} />} />
                  <Bar dataKey="gramos" fill={DORADO} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="gramos" position="right"
                      formatter={(v) => formatGramos(Number(v ?? 0))}
                      style={{ fill: 'rgba(255,255,255,0.75)', fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Altas de socios */}
          <motion.div variants={fadeUp} className="glass-card p-5">
            <h3 className="font-avigea text-base text-foreground mb-4">Altas de socios</h3>
            {serieAltas.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">Sin altas en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serieAltas} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<TooltipClub formatter={(v: number) => `${v} alta${v !== 1 ? 's' : ''}`} />} />
                  <Bar dataKey="altas" fill={ESMERALDA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

        </div>
      )}

    </motion.div>
  );
}
