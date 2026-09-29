'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Loader2, Users, Shield, History } from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { ACCION_LABEL, ACCION_SOCIO_LABEL, RECURSO_LABEL, resumenMetadata } from './labels';

// Entrada unificada: acción de socio (actividad_socios) o de admin (audit_log)
export interface EntradaActividad {
  id:       string;
  origen:   'socio' | 'admin';
  fecha:    string;
  accion:   string;
  recurso:  string | null;
  detalle:  Record<string, unknown> | null;
  actor:    { id: string; nombre: string } | null;
  afectado: { id: string; nombre: string } | null;
}

type Origen     = 'todos' | 'socio' | 'admin';
type Agrupacion = 'dia' | 'mes' | 'anio';

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
  const hace7  = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
  const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
  const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
  return [
    { label: 'Últimos 7',  desde: hoyISO(hace7),      hasta: hoyISO(hoy) },
    { label: 'Últimos 30', desde: hoyISO(hace30),     hasta: hoyISO(hoy) },
    { label: 'Últimos 90', desde: hoyISO(hace90),     hasta: hoyISO(hoy) },
    { label: 'Este año',   desde: hoyISO(inicioAnio), hasta: hoyISO(hoy) },
  ];
}

// Clave de período para el gráfico
function clavePeriodo(fecha: string, g: Agrupacion): string {
  const d = new Date(fecha);
  if (g === 'anio') return String(d.getFullYear());
  if (g === 'mes')  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return hoyISO(d);
}
function labelPeriodo(clave: string, g: Agrupacion): string {
  if (g === 'anio') return clave;
  if (g === 'mes')  return formatFecha(`${clave}-01`, 'MMM yyyy');
  return formatFecha(clave, 'dd MMM');
}

function labelAccion(e: EntradaActividad): string {
  const map = e.origen === 'socio' ? ACCION_SOCIO_LABEL : ACCION_LABEL;
  return map[e.accion] ?? e.accion.replace(/_/g, ' ');
}

// Tooltip oscuro estilo club
function TooltipClub({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-club-verde-claro/40 bg-club-verde px-3.5 py-2.5 shadow-club-md text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="text-foreground font-semibold">{payload[0].value} {payload[0].value === 1 ? 'acción' : 'acciones'}</p>
    </div>
  );
}

interface Props {
  entradas: EntradaActividad[];
  desde:    string;
  hasta:    string;
}

export function ActividadClient({ entradas, desde: desdeInicial, hasta: hastaInicial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Rango (viaja por URL: el server trae solo ese período)
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const aplicarRango = (d: string, h: string) => {
    setDesde(d); setHasta(h);
    startTransition(() => router.push(`/admin/actividad?desde=${d}&hasta=${h}`));
  };

  // Filtros locales
  const [origen, setOrigen]     = useState<Origen>('todos');
  const [usuario, setUsuario]   = useState('todos');
  const [accion, setAccion]     = useState('todas');
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('dia');

  // Opciones de usuario y acción: solo las que aparecen en el período
  const usuarios = useMemo(() => {
    const m = new Map<string, string>();
    entradas.forEach(e => { if (e.actor) m.set(e.actor.id, e.actor.nombre); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entradas]);
  const acciones = useMemo(() => {
    const m = new Map<string, string>();
    entradas
      .filter(e => origen === 'todos' || e.origen === origen)
      .forEach(e => m.set(`${e.origen}:${e.accion}`, labelAccion(e)));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entradas, origen]);

  const filtradas = useMemo(() => entradas.filter(e => {
    if (origen !== 'todos' && e.origen !== origen) return false;
    if (usuario !== 'todos' && e.actor?.id !== usuario) return false;
    if (accion !== 'todas' && `${e.origen}:${e.accion}` !== accion) return false;
    return true;
  }), [entradas, origen, usuario, accion]);

  // Gráfico: SOLO socios (respeta usuario y acción, no el origen)
  const serie = useMemo(() => {
    const conteo = new Map<string, number>();
    entradas
      .filter(e => e.origen === 'socio')
      .filter(e => usuario === 'todos' || e.actor?.id === usuario)
      .filter(e => accion === 'todas' || `${e.origen}:${e.accion}` === accion)
      .forEach(e => {
        const k = clavePeriodo(e.fecha, agrupacion);
        conteo.set(k, (conteo.get(k) ?? 0) + 1);
      });
    return Array.from(conteo.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ label: labelPeriodo(k, agrupacion), acciones: v }));
  }, [entradas, usuario, accion, agrupacion]);

  const totalSocios = entradas.filter(e => e.origen === 'socio').length;
  const totalAdmins = entradas.length - totalSocios;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        title="Actividad"
        subtitle="Qué hacen los socios y los administradores en la app"
        icon={<Activity className="w-5 h-5" />}
      />

      {/* Rango de fechas */}
      <motion.div variants={fadeUp} className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {presets().map(p => (
            <button key={p.label} onClick={() => aplicarRango(p.desde, p.hasta)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                desde === p.desde && hasta === p.hasta
                  ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                  : 'text-muted-foreground hover:text-foreground bg-white/5'
              )}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="input-club py-1.5 text-xs" />
          <span className="text-muted-foreground text-xs">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="input-club py-1.5 text-xs" />
          <button onClick={() => aplicarRango(desde, hasta)} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-xs font-semibold hover:bg-club-dorado/25 transition-colors disabled:opacity-50">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
          </button>
        </div>
      </motion.div>

      {/* Gráfico: actividad de socios por período */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-avigea text-base text-foreground">Actividad de socios</h3>
            <p className="text-muted-foreground text-xs">{totalSocios} acciones de socios · {totalAdmins} de administración en el período</p>
          </div>
          <div className="flex gap-1 p-1 glass-card rounded-lg">
            {([['dia', 'Día'], ['mes', 'Mes'], ['anio', 'Año']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setAgrupacion(v)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                  agrupacion === v ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {serie.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">Sin actividad de socios en el período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: EJE, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<TooltipClub />} />
              <Bar dataKey="acciones" fill={DORADO} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Filtros del listado */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 glass-card rounded-xl">
          {([['todos', 'Todos', History], ['socio', 'Socios', Users], ['admin', 'Admins', Shield]] as const).map(([v, l, Icono]) => (
            <button key={v} onClick={() => { setOrigen(v); setAccion('todas'); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                origen === v ? 'bg-club-dorado text-club-verde shadow-dorado-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icono className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>
        <select value={usuario} onChange={e => setUsuario(e.target.value)}
          className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs">
          <option value="todos">Todos los usuarios</option>
          {usuarios.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <select value={accion} onChange={e => setAccion(e.target.value)}
          className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs">
          <option value="todas">Todas las acciones</option>
          {acciones.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="text-muted-foreground text-xs ml-auto">{filtradas.length} registros</span>
      </motion.div>

      {/* Listado */}
      {filtradas.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center">
          <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Sin actividad con esos filtros.</p>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/15">
          {filtradas.map(e => {
            const detalle = resumenMetadata(e.detalle);
            return (
              <div key={e.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  <span className={cn(
                    'mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border',
                    e.origen === 'socio'
                      ? 'bg-club-dorado/10 border-club-dorado/30 text-club-dorado'
                      : 'bg-white/5 border-white/10 text-muted-foreground'
                  )}>
                    {e.origen === 'socio' ? <Users className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground text-sm">
                      <span className="font-semibold">{e.actor?.nombre ?? (e.origen === 'socio' ? 'Socio' : 'Admin')}</span>{' '}
                      <span className="text-foreground/80">{labelAccion(e)}</span>
                      {e.afectado?.nombre && <span className="text-muted-foreground"> — {e.afectado.nombre}</span>}
                    </p>
                    {detalle && <p className="text-muted-foreground text-xs mt-0.5 truncate">{detalle}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {e.recurso && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] border border-club-verde-claro/30 text-muted-foreground mb-1">
                      {RECURSO_LABEL[e.recurso] ?? e.recurso}
                    </span>
                  )}
                  <p className="text-muted-foreground text-xs">{formatFecha(e.fecha, "dd MMM yyyy · HH:mm")}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
