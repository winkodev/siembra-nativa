'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, MapPin, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check,
  SlidersHorizontal, History, CalendarClock,
} from 'lucide-react';
import { cn, formatFecha, formatFranja } from '@/lib/utils';
import {
  crearUbicacion, actualizarUbicacion, eliminarUbicacion, toggleUbicacionActiva, guardarConfigApp,
  crearFranja, actualizarFranja, eliminarFranja, toggleFranjaActiva,
} from '@/app/actions/configuracion';
import type { Ubicacion, AuditLog, FranjaHoraria } from '@/lib/types/database';
import type { AppConfig } from '@/lib/supabase/config';

// Entrada de audit_log con los nombres resueltos
export interface AuditEntry extends AuditLog {
  admin: { nombre: string } | null;
  socio: { nombre: string } | null;
}

const tabs = [
  { id: 'general',     label: 'General',     icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'horarios',    label: 'Horarios',    icon: <CalendarClock className="w-4 h-4" /> },
  { id: 'ubicaciones', label: 'Ubicaciones', icon: <MapPin className="w-4 h-4" /> },
  { id: 'actividad',   label: 'Actividad',   icon: <History className="w-4 h-4" /> },
];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

interface Props {
  ubicaciones: Ubicacion[];
  franjas:     FranjaHoraria[];
  config:      AppConfig;
  actividad:   AuditEntry[];
}


export function ConfiguracionClient({ ubicaciones, franjas, config, actividad }: Props) {
  const [tab, setTab] = useState('general');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-club-dorado/15 border border-club-dorado/25 flex items-center justify-center text-club-dorado shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-avigea text-2xl sm:text-3xl text-foreground leading-tight">Configuración</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Parámetros generales del club</p>
          </div>
        </div>
        <div className="divider-dorado mt-3" />
      </div>

      <div className="flex gap-1.5 p-1 glass-card rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              tab === t.id
                ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'general'     && <GeneralTab config={config} />}
      {tab === 'horarios'    && <FranjasTab franjas={franjas} />}
      {tab === 'ubicaciones' && <UbicacionesTab ubicaciones={ubicaciones} />}
      {tab === 'actividad'   && <ActividadTab actividad={actividad} />}
    </div>
  );
}

// ── Tab Horarios (franjas de entrega) ─────────────────────────

function FranjasTab({ franjas: inicial }: { franjas: FranjaHoraria[] }) {
  const [items, setItems]          = useState(inicial);
  const [modal, setModal]          = useState(false);
  const [editando, setEditando]    = useState<FranjaHoraria | null>(null);
  const [dia, setDia]              = useState('');
  const [desde, setDesde]          = useState('09:00');
  const [hasta, setHasta]          = useState('18:00');
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const abrirCrear = () => {
    setEditando(null); setDia(''); setDesde('09:00'); setHasta('18:00'); setError(null); setModal(true);
  };
  const abrirEditar = (f: FranjaHoraria) => {
    setEditando(f); setDia(f.dia); setDesde(f.hora_desde.slice(0, 5)); setHasta(f.hora_hasta.slice(0, 5));
    setError(null); setModal(true);
  };

  const handleGuardar = () => {
    setError(null);
    startTransition(async () => {
      if (editando) {
        const res = await actualizarFranja(editando.id, dia, desde, hasta);
        if (!res.ok) { setError(res.error); return; }
        setItems(prev => prev.map(f => f.id === editando.id ? res.data : f));
      } else {
        const res = await crearFranja(dia, desde, hasta);
        if (!res.ok) { setError(res.error); return; }
        setItems(prev => [...prev, res.data]);
      }
      setModal(false);
    });
  };

  const handleToggle = (id: string, activa: boolean) => {
    startTransition(async () => {
      const res = await toggleFranjaActiva(id, !activa);
      if (!res.ok) return;
      setItems(prev => prev.map(f => f.id === id ? { ...f, activa: !activa } : f));
    });
  };

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      const res = await eliminarFranja(id);
      if (!res.ok) { setError(res.error); return; }
      setItems(prev => prev.filter(f => f.id !== id));
      setConfirmDel(null);
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-2xl">

      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Horarios de entrega que el socio puede elegir al confirmar su pedido.
        </p>
        <button onClick={abrirCrear} className="btn-primary text-sm px-4 py-2">
          <Plus className="w-4 h-4" /> Nueva franja
        </button>
      </motion.div>

      {error && !modal && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {items.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center">
          <CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            No hay franjas cargadas. Sin franjas activas, el pedido no pide horario.
          </p>
        </motion.div>
      ) : (
        <div className="glass-card divide-y divide-club-verde-claro/15">
          {items.map(f => (
            <motion.div key={f.id} variants={fadeUp}
              className={cn('flex items-center justify-between px-5 py-4', !f.activa && 'opacity-50')}
            >
              <div className="flex items-center gap-3">
                <CalendarClock className="w-4 h-4 text-club-dorado shrink-0" />
                <p className="text-foreground font-medium text-sm">{formatFranja(f)}</p>
                {!f.activa && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 text-muted-foreground">Inactiva</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => abrirEditar(f)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/20 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleToggle(f.id, f.activa)} disabled={pending}
                  className="p-2 rounded-lg text-muted-foreground hover:text-club-dorado hover:bg-club-verde-claro/20 transition-all">
                  {f.activa ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => setConfirmDel(f.id)}
                  className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal crear/editar franja */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-avigea text-lg text-foreground">{editando ? 'Editar franja' : 'Nueva franja'}</h2>
                <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Día *</label>
                  <input value={dia} onChange={e => setDia(e.target.value)} className="input-club w-full"
                    placeholder="Ej: Sábados, Lunes a Viernes" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Desde *</label>
                    <input type="time" value={desde} onChange={e => setDesde(e.target.value)} className="input-club w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Hasta *</label>
                    <input type="time" value={hasta} onChange={e => setHasta(e.target.value)} className="input-club w-full" />
                  </div>
                </div>
              </div>
              {error && (
                <div className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={handleGuardar} disabled={pending} className="btn-primary flex-1 py-2.5">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Guardar</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm eliminar franja */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm p-6 text-center space-y-4">
              <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-foreground font-semibold">¿Eliminar franja horaria?</p>
              <p className="text-muted-foreground text-xs">Los pedidos ya hechos conservan el horario que eligieron.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={() => handleEliminar(confirmDel)} disabled={pending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all font-semibold">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// ── Tab Actividad (log de acciones de admin) ──────────────────

// Traducción legible de cada acción registrada
const ACCION_LABEL: Record<string, string> = {
  editar_config:         'Editó la configuración',
  crear_ubicacion:       'Creó una ubicación',
  editar_ubicacion:      'Editó una ubicación',
  eliminar_ubicacion:    'Eliminó una ubicación',
  crear_genetica:        'Creó una genética',
  editar_genetica:       'Editó una genética',
  activar_genetica:      'Activó una genética',
  desactivar_genetica:   'Desactivó una genética',
  eliminar_genetica:     'Eliminó una genética',
  agregar_stock:         'Registró un ingreso de stock',
  editar_stock:          'Editó un ingreso de stock',
  eliminar_stock:        'Eliminó un ingreso de stock',
  crear_producto:        'Creó un producto',
  editar_producto:       'Editó un producto',
  activar_producto:      'Activó un producto',
  desactivar_producto:   'Desactivó un producto',
  eliminar_producto:     'Eliminó un producto',
  pedido_aprobado:       'Aprobó un pedido',
  pedido_entregado:      'Entregó un pedido',
  pedido_cancelado:      'Canceló un pedido',
  crear_articulo:        'Creó un artículo del newsletter',
  editar_articulo:       'Editó un artículo del newsletter',
  publicar_articulo:     'Publicó un artículo',
  despublicar_articulo:  'Despublicó un artículo',
  eliminar_articulo:     'Eliminó un artículo',
  aprobar_reprocann:     'Aprobó documentación REPROCANN',
  rechazar_reprocann:    'Rechazó documentación REPROCANN',
  activar_socio:         'Activó un socio',
  desactivar_socio:      'Desactivó un socio',
  agregar_nota:          'Agregó una nota de socio',
  ver_certificado:       'Vio un certificado REPROCANN',
  ver_comprobante_pago:  'Vio un comprobante de pago',
  crear_franja:          'Creó una franja horaria',
  editar_franja:         'Editó una franja horaria',
  activar_franja:        'Activó una franja horaria',
  desactivar_franja:     'Desactivó una franja horaria',
  eliminar_franja:       'Eliminó una franja horaria',
  imprimir_pedido:       'Imprimió un pedido',
  crear_usuario:         'Creó un usuario',
  promover_admin:        'Promovió a administrador',
  degradar_admin:        'Quitó rol de administrador',
};

const RECURSO_LABEL: Record<string, string> = {
  configuracion:          'Configuración',
  ubicaciones:            'Ubicaciones',
  geneticas:              'Genéticas',
  stock:                  'Stock',
  productos:              'Productos',
  pedidos:                'Pedidos',
  newsletter:             'Newsletter',
  reprocann:              'REPROCANN',
  socios:                 'Socios',
  socio_notas:            'Notas',
  reprocann_certificado:  'Certificados',
  comprobante_pago:       'Comprobantes',
  franjas:                'Horarios',
  usuarios:               'Usuarios',
};

// Resumen compacto del metadata (omite ids, que no le dicen nada al admin)
function resumenMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const partes = Object.entries(metadata)
    .filter(([k, v]) => v != null && !k.endsWith('id') && k !== 'path')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return partes.length ? partes.join(' · ') : null;
}

function ActividadTab({ actividad }: { actividad: AuditEntry[] }) {
  const [filtro, setFiltro] = useState('todos');

  // Solo se ofrecen como filtro los recursos que aparecen en el log
  const recursos = useMemo(
    () => Array.from(new Set(actividad.map(a => a.recurso))),
    [actividad]
  );

  const filtradas = filtro === 'todos' ? actividad : actividad.filter(a => a.recurso === filtro);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-3xl">

      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-muted-foreground text-sm">Últimas {actividad.length} acciones de administración.</p>
        {recursos.length > 1 && (
          <select
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs"
          >
            <option value="todos">Todos los módulos</option>
            {recursos.map(r => (
              <option key={r} value={r}>{RECURSO_LABEL[r] ?? r}</option>
            ))}
          </select>
        )}
      </motion.div>

      {filtradas.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center">
          <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Sin actividad registrada todavía.</p>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/15">
          {filtradas.map(a => {
            const detalle = resumenMetadata(a.metadata);
            return (
              <div key={a.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-foreground text-sm">
                    <span className="font-semibold">{a.admin?.nombre ?? 'Admin'}</span>{' '}
                    <span className="text-foreground/80">{ACCION_LABEL[a.accion] ?? a.accion.replace(/_/g, ' ')}</span>
                    {a.socio?.nombre && <span className="text-muted-foreground"> — {a.socio.nombre}</span>}
                  </p>
                  {detalle && (
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">{detalle}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] border border-club-verde-claro/30 text-muted-foreground mb-1">
                    {RECURSO_LABEL[a.recurso] ?? a.recurso}
                  </span>
                  <p className="text-muted-foreground text-[11px]">{formatFecha(a.fecha, 'dd MMM · HH:mm')}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Tab General ───────────────────────────────────────────────

function GeneralTab({ config }: { config: AppConfig }) {
  const [stockMin,   setStockMin]   = useState(config.stock_minimo_visible.toString());
  const [maxGramos,  setMaxGramos]  = useState(config.max_gramos_pedido.toString());
  const [comprobante, setComprobante] = useState(config.comprobante_obligatorio);
  const [costoEnvio, setCostoEnvio]   = useState(config.costo_envio.toString());
  const [gratisDesde, setGratisDesde] = useState(config.envio_gratis_desde.toString());
  const [avisoDias, setAvisoDias]     = useState(config.reprocann_aviso_dias.toString());
  const [desc20, setDesc20]           = useState(config.descuento_20.toString());
  const [desc40, setDesc40]           = useState(config.descuento_40.toString());
  const [pending, startTransition]  = useTransition();
  const [saved, setSaved]           = useState(false);

  const handleGuardar = () => {
    startTransition(async () => {
      await Promise.all([
        guardarConfigApp('stock_minimo_visible',    stockMin),
        guardarConfigApp('max_gramos_pedido',       maxGramos),
        guardarConfigApp('comprobante_obligatorio', comprobante ? 'true' : 'false'),
        guardarConfigApp('costo_envio',             costoEnvio || '0'),
        guardarConfigApp('envio_gratis_desde',      gratisDesde || '0'),
        guardarConfigApp('reprocann_aviso_dias',    avisoDias || '30'),
        guardarConfigApp('descuento_20',            desc20 || '0'),
        guardarConfigApp('descuento_40',            desc40 || '0'),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-lg">

      {/* Stock mínimo */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div>
          <p className="text-foreground font-medium text-sm">Stock mínimo visible en catálogo</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Una genética solo aparece en el catálogo si tiene al menos esta cantidad de gramos disponibles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number" min="0" step="10" value={stockMin}
            onChange={e => setStockMin(e.target.value)}
            className="input-club w-32 text-center text-lg font-bold text-club-dorado"
          />
          <span className="text-muted-foreground text-sm">gramos</span>
        </div>
      </motion.div>

      {/* Máximo por pedido */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div>
          <p className="text-foreground font-medium text-sm">Máximo de gramos por pedido</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Un socio no puede pedir más de esta cantidad en un solo pedido.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number" min="10" step="10" value={maxGramos}
            onChange={e => setMaxGramos(e.target.value)}
            className="input-club w-32 text-center text-lg font-bold text-club-dorado"
          />
          <span className="text-muted-foreground text-sm">gramos</span>
        </div>
      </motion.div>

      {/* Envío a domicilio */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        <div>
          <p className="text-foreground font-medium text-sm">Envío a domicilio</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            El monto se suma al pedido y el socio lo ve antes de confirmar.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Costo del envío ($)</label>
            <input
              type="number" min="0" step="50" value={costoEnvio}
              onChange={e => setCostoEnvio(e.target.value)}
              className="input-club w-full text-center text-lg font-bold text-club-dorado"
            />
            <p className="text-muted-foreground text-[11px]">0 = no se cobra envío</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Gratis desde (gramos)</label>
            <input
              type="number" min="0" step="10" value={gratisDesde}
              onChange={e => setGratisDesde(e.target.value)}
              className="input-club w-full text-center text-lg font-bold text-club-dorado"
            />
            <p className="text-muted-foreground text-[11px]">0 = se cobra siempre · ej: 40 = gratis desde 40g</p>
          </div>
        </div>
      </motion.div>

      {/* Descuento por cantidad */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        <div>
          <p className="text-foreground font-medium text-sm">Descuento por cantidad</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Se aplica sobre el precio de las flores. Al alcanzar 40g gana el descuento mayor.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Al pedir 20g o más (%)</label>
            <input
              type="number" min="0" max="100" step="1" value={desc20}
              onChange={e => setDesc20(e.target.value)}
              className="input-club w-full text-center text-lg font-bold text-club-dorado"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Al pedir 40g o más (%)</label>
            <input
              type="number" min="0" max="100" step="1" value={desc40}
              onChange={e => setDesc40(e.target.value)}
              className="input-club w-full text-center text-lg font-bold text-club-dorado"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">0 = sin descuento</p>
      </motion.div>

      {/* Aviso de vencimiento REPROCANN */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div>
          <p className="text-foreground font-medium text-sm">Aviso de vencimiento REPROCANN</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Con cuántos días de anticipación se le avisa al socio (notificación in-app) que su REPROCANN vence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number" min="1" max="180" step="1" value={avisoDias}
            onChange={e => setAvisoDias(e.target.value)}
            className="input-club w-32 text-center text-lg font-bold text-club-dorado"
          />
          <span className="text-muted-foreground text-sm">días antes</span>
        </div>
      </motion.div>

      {/* Comprobante obligatorio */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-foreground font-medium text-sm">Comprobante de pago obligatorio</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Si está activo, el socio debe adjuntarlo al confirmar el pedido, y no se puede aprobar sin él.
            </p>
          </div>
          <button
            onClick={() => setComprobante(v => !v)}
            className={cn(
              'shrink-0 transition-colors',
              comprobante ? 'text-club-dorado' : 'text-muted-foreground'
            )}
            aria-label="Alternar comprobante obligatorio"
          >
            {comprobante ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
          </button>
        </div>
      </motion.div>

      {/* Guardar */}
      <motion.div variants={fadeUp}>
        <button onClick={handleGuardar} disabled={pending} className="btn-primary px-6 py-2.5">
          {pending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            : saved
            ? <><Check className="w-4 h-4" /> Guardado</>
            : 'Guardar cambios'
          }
        </button>
      </motion.div>

    </motion.div>
  );
}

// ── Tab Ubicaciones ───────────────────────────────────────────

function UbicacionesTab({ ubicaciones: inicial }: { ubicaciones: Ubicacion[] }) {
  const [items, setItems]          = useState(inicial);
  const [modal, setModal]          = useState(false);
  const [editando, setEditando]    = useState<Ubicacion | null>(null);
  const [nombre, setNombre]        = useState('');
  const [descripcion, setDesc]     = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const abrirCrear = () => {
    setEditando(null); setNombre(''); setDesc(''); setError(null); setModal(true);
  };
  const abrirEditar = (u: Ubicacion) => {
    setEditando(u); setNombre(u.nombre); setDesc(u.descripcion ?? ''); setError(null); setModal(true);
  };

  const handleGuardar = () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError(null);
    startTransition(async () => {
      if (editando) {
        const res = await actualizarUbicacion(editando.id, nombre.trim(), descripcion.trim() || null);
        if (!res.ok) { setError(res.error); return; }
        setItems(prev => prev.map(u => u.id === editando.id ? res.data : u));
      } else {
        const res = await crearUbicacion(nombre.trim(), descripcion.trim() || null);
        if (!res.ok) { setError(res.error); return; }
        setItems(prev => [...prev, res.data]);
      }
      setModal(false);
    });
  };

  const handleToggle = (id: string, activa: boolean) => {
    startTransition(async () => {
      const res = await toggleUbicacionActiva(id, !activa);
      if (!res.ok) return;
      setItems(prev => prev.map(u => u.id === id ? { ...u, activa: !activa } : u));
    });
  };

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      const res = await eliminarUbicacion(id);
      if (!res.ok) { setError(res.error); return; }
      setItems(prev => prev.filter(u => u.id !== id));
      setConfirmDel(null);
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-2xl">

      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Lugares físicos donde se almacena el stock.</p>
        <button onClick={abrirCrear} className="btn-primary text-sm px-4 py-2">
          <Plus className="w-4 h-4" /> Nueva ubicación
        </button>
      </motion.div>

      {error && !modal && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {items.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No hay ubicaciones cargadas.</p>
        </motion.div>
      ) : (
        <div className="glass-card divide-y divide-club-verde-claro/15">
          {items.map(u => (
            <motion.div key={u.id} variants={fadeUp}
              className={cn('flex items-center justify-between px-5 py-4', !u.activa && 'opacity-50')}
            >
              <div>
                <p className="text-foreground font-medium text-sm">{u.nombre}</p>
                {u.descripcion && <p className="text-muted-foreground text-xs mt-0.5">{u.descripcion}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => abrirEditar(u)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/20 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleToggle(u.id, u.activa)} disabled={pending}
                  className="p-2 rounded-lg text-muted-foreground hover:text-club-dorado hover:bg-club-verde-claro/20 transition-all">
                  {u.activa ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => setConfirmDel(u.id)}
                  className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-avigea text-lg text-foreground">{editando ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
                <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Nombre *</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-club w-full" placeholder="Ej: Heladera" />
                </div>
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Descripción</label>
                  <input value={descripcion} onChange={e => setDesc(e.target.value)} className="input-club w-full" placeholder="Opcional..." />
                </div>
              </div>
              {error && (
                <div className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={handleGuardar} disabled={pending} className="btn-primary flex-1 py-2.5">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Guardar</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm p-6 text-center space-y-4">
              <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-foreground font-semibold">¿Eliminar ubicación?</p>
              <p className="text-muted-foreground text-xs">Los lotes de stock asociados no se van a borrar.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={() => handleEliminar(confirmDel)} disabled={pending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all font-semibold">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
