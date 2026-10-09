'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, MapPin, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check,
  SlidersHorizontal, CalendarClock, Landmark, Mail,
} from 'lucide-react';
import { EVENTOS_AVISO, PROVEEDORES_EMAIL, type ProveedorEmail } from '@/lib/avisos';
import { cn, formatFecha, formatFranja, labelDias, DIAS_CORTOS } from '@/lib/utils';
import {
  crearUbicacion, actualizarUbicacion, eliminarUbicacion, toggleUbicacionActiva, guardarConfigApp,
  crearFranja, actualizarFranja, eliminarFranja, toggleFranjaActiva, guardarDatosPago, probarEmailAviso,
} from '@/app/actions/configuracion';
import type { Ubicacion, FranjaHoraria } from '@/lib/types/database';
import type { AppConfig, DatosPago } from '@/lib/supabase/config';


const tabs = [
  { id: 'general',     label: 'General',     icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'horarios',    label: 'Horarios',    icon: <CalendarClock className="w-4 h-4" /> },
  { id: 'ubicaciones', label: 'Ubicaciones', icon: <MapPin className="w-4 h-4" /> },
];
// Solo la ve el superadmin: alias / CBU donde transfieren los socios
const tabPagos = { id: 'pagos', label: 'Pagos', icon: <Landmark className="w-4 h-4" /> };
// Avisos por email a los admins
const tabAvisos = { id: 'avisos', label: 'Avisos', icon: <Mail className="w-4 h-4" /> };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

interface Props {
  ubicaciones: Ubicacion[];
  franjas:     FranjaHoraria[];
  config:      AppConfig;
  superadmin:  boolean;
  // Qué métodos de email tienen sus variables cargadas en el servidor
  proveedoresEmail: { resend: boolean; gmail: boolean };
}


export function ConfiguracionClient({ ubicaciones, franjas, config, superadmin, proveedoresEmail }: Props) {
  const [tab, setTab] = useState('general');
  const tabsVisibles = superadmin ? [...tabs, tabAvisos, tabPagos] : [...tabs, tabAvisos];

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
        {tabsVisibles.map(t => (
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
      {tab === 'horarios'    && <FranjasTab franjas={franjas} config={config} />}
      {tab === 'ubicaciones' && <UbicacionesTab ubicaciones={ubicaciones} />}
      {tab === 'avisos' && <AvisosTab config={config} proveedores={proveedoresEmail} />}
      {tab === 'pagos' && superadmin && <PagosTab config={config} />}
    </div>
  );
}

// ── Tab Avisos: emails a los admins por eventos ───────────────

function AvisosTab({ config, proveedores }: { config: AppConfig; proveedores: { resend: boolean; gmail: boolean } }) {
  const [emails, setEmails] = useState(config.avisos_emails);
  const [proveedor, setProveedor] = useState<ProveedorEmail>(config.avisos_proveedor);
  // Email de prueba
  const [emailPrueba, setEmailPrueba] = useState('');
  const [probando, setProbando]       = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<string | null>(null);
  const handleProbar = async () => {
    setProbando(true);
    setResultadoPrueba(null);
    const res = await probarEmailAviso(emailPrueba, proveedor);
    setProbando(false);
    setResultadoPrueba(res.ok ? `Enviado a ${emailPrueba.trim()}. Revisá la bandeja (y spam).` : res.error);
  };
  const [eventos, setEventos] = useState<Record<string, boolean>>({
    nuevo_pedido: config.avisos_nuevo_pedido,
    comprobante:  config.avisos_comprobante,
    certificado:  config.avisos_certificado,
    consulta:     config.avisos_consulta,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved]          = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const listaEmails = emails.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
  const invalidos   = listaEmails.filter(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  const handleGuardar = () => {
    setError(null);
    if (invalidos.length > 0) { setError(`Revisá estas direcciones: ${invalidos.join(', ')}`); return; }
    startTransition(async () => {
      const res = await Promise.all([
        guardarConfigApp('avisos_emails', listaEmails.join(', ')),
        guardarConfigApp('avisos_proveedor', proveedor),
        ...EVENTOS_AVISO.map(ev => guardarConfigApp(`avisos_${ev.clave}`, eventos[ev.clave] ? 'true' : 'false')),
      ]);
      const fallo = res.find(r => !r.ok);
      if (fallo && !fallo.ok) { setError(fallo.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        <div>
          <p className="text-foreground font-medium text-sm">Avisos por email a los administradores</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Cuando pasa alguno de estos eventos, se manda un email a las direcciones de abajo.
            Los socios no reciben nada por acá.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-foreground/80 font-medium">Direcciones (separadas por coma)</label>
          <textarea value={emails} onChange={e => setEmails(e.target.value)} rows={2}
            className="input-club w-full resize-none" placeholder="admin@siembranativa.com.ar, otro@gmail.com" />
          {listaEmails.length > 0 && (
            <p className="text-muted-foreground text-[11px]">{listaEmails.length} direcci{listaEmails.length === 1 ? 'ón' : 'ones'}</p>
          )}
        </div>

        {/* Método de envío */}
        <div className="space-y-2">
          <p className="text-xs text-foreground/80 font-medium">Método de envío</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROVEEDORES_EMAIL.map(pv => {
              const disponible = pv.clave === 'auto' ? (proveedores.gmail || proveedores.resend) : proveedores[pv.clave];
              return (
                <button key={pv.clave} type="button" onClick={() => setProveedor(pv.clave)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-xl border transition-all',
                    proveedor === pv.clave ? 'bg-club-dorado/10 border-club-dorado/40' : 'bg-white/5 border-white/10 hover:border-club-dorado/30'
                  )}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground font-medium">{pv.label}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border',
                      disponible ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-muted-foreground border-white/10')}>
                      {disponible ? 'configurado' : 'sin configurar'}
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{pv.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-[11px]">
            Gmail: variables <code>GMAIL_USER</code> y <code>GMAIL_APP_PASSWORD</code>. Resend: <code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code>. Se cargan en el servidor, no acá.
          </p>
        </div>

        {/* Prueba */}
        <div className="space-y-1.5">
          <p className="text-xs text-foreground/80 font-medium">Mandar un email de prueba con el método elegido</p>
          <div className="flex gap-2">
            <input type="email" value={emailPrueba} onChange={e => setEmailPrueba(e.target.value)}
              className="input-club flex-1 py-2 text-sm" placeholder="tu@email.com" />
            <button type="button" onClick={handleProbar} disabled={probando || !emailPrueba.trim()}
              className="px-4 py-2 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-sm font-semibold hover:bg-club-dorado/25 transition-colors disabled:opacity-40 flex items-center gap-2">
              {probando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Probar
            </button>
          </div>
          {resultadoPrueba && <p className="text-xs text-muted-foreground">{resultadoPrueba}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-foreground/80 font-medium">Eventos</p>
          {EVENTOS_AVISO.map(ev => (
            <button key={ev.clave} type="button" onClick={() => setEventos(prev => ({ ...prev, [ev.clave]: !prev[ev.clave] }))}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                eventos[ev.clave] ? 'bg-club-dorado/10 border-club-dorado/40' : 'bg-white/5 border-white/10 hover:border-club-dorado/30'
              )}>
              <span>
                <span className="block text-sm text-foreground font-medium">{ev.label}</span>
                <span className="block text-xs text-muted-foreground">{ev.desc}</span>
              </span>
              <span className={cn('shrink-0', eventos[ev.clave] ? 'text-club-dorado' : 'text-muted-foreground')}>
                {eventos[ev.clave] ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
              </span>
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-[11px]">
          Si el método elegido no tiene sus variables cargadas en el servidor, los avisos se saltan sin afectar nada.
        </p>

        {error && (
          <p className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</p>
        )}

        <div className="flex justify-end">
          <button onClick={handleGuardar} disabled={pending} className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Tab Pagos (solo superadmin): alias / CBU para transferencias ──

function PagosTab({ config }: { config: AppConfig }) {
  const [datos, setDatos] = useState<DatosPago>({
    pago_alias:         config.pago_alias,
    pago_cbu:           config.pago_cbu,
    pago_titular:       config.pago_titular,
    pago_banco:         config.pago_banco,
    pago_instrucciones: config.pago_instrucciones,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved]          = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const set = (k: keyof DatosPago) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDatos(d => ({ ...d, [k]: e.target.value }));

  const handleGuardar = () => {
    setError(null);
    startTransition(async () => {
      const res = await guardarDatosPago(datos);
      if (!res.ok) { setError(res.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        <div>
          <p className="text-foreground font-medium text-sm">Cuenta para transferencias</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            El socio ve estos datos al confirmar el pedido, antes de adjuntar el comprobante.
            Si alias y CBU están vacíos, no se muestra nada.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Alias</label>
            <input value={datos.pago_alias} onChange={set('pago_alias')} className="input-club w-full" placeholder="club.nativa.mp" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">CBU (22 dígitos)</label>
            <input value={datos.pago_cbu} onChange={set('pago_cbu')} className="input-club w-full font-mono" inputMode="numeric" placeholder="0000000000000000000000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Titular</label>
            <input value={datos.pago_titular} onChange={set('pago_titular')} className="input-club w-full" placeholder="Asociación Civil María Nativa Club de Cultivo" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/80 font-medium">Banco</label>
            <input value={datos.pago_banco} onChange={set('pago_banco')} className="input-club w-full" placeholder="Banco Nación" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-foreground/80 font-medium">Instrucciones (opcional)</label>
          <textarea value={datos.pago_instrucciones} onChange={set('pago_instrucciones')} rows={3}
            className="input-club w-full resize-none" placeholder="Ej: poné tu nombre en el concepto de la transferencia." />
        </div>

        {error && (
          <p className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</p>
        )}

        <div className="flex justify-end">
          <button onClick={handleGuardar} disabled={pending} className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Tab Horarios (franjas de entrega) ─────────────────────────

function FranjasTab({ franjas: inicial, config }: { franjas: FranjaHoraria[]; config: AppConfig }) {
  const [items, setItems]          = useState(inicial);
  const [modal, setModal]          = useState(false);
  const [editando, setEditando]    = useState<FranjaHoraria | null>(null);
  // Días de la semana de la franja (0 = domingo ... 6 = sábado)
  const [dias, setDias]            = useState<number[]>([]);
  const [desde, setDesde]          = useState('09:00');
  const [hasta, setHasta]          = useState('18:00');
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Anticipación mínima (horas) entre el pedido y la entrega
  const [anticipacion, setAnticipacion] = useState(String(config.entrega_anticipacion_horas));
  const [anticipacionOk, setAnticipacionOk] = useState(false);
  const guardarAnticipacion = () => {
    startTransition(async () => {
      const res = await guardarConfigApp('entrega_anticipacion_horas', String(Math.max(0, parseFloat(anticipacion) || 0)));
      if (!res.ok) { setError(res.error); return; }
      setAnticipacionOk(true);
      setTimeout(() => setAnticipacionOk(false), 2000);
    });
  };

  const toggleDia = (d: number) =>
    setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));

  const abrirCrear = () => {
    setEditando(null); setDias([]); setDesde('09:00'); setHasta('18:00'); setError(null); setModal(true);
  };
  const abrirEditar = (f: FranjaHoraria) => {
    setEditando(f); setDias(f.dias_semana ?? []); setDesde(f.hora_desde.slice(0, 5)); setHasta(f.hora_hasta.slice(0, 5));
    setError(null); setModal(true);
  };

  const handleGuardar = () => {
    setError(null);
    startTransition(async () => {
      if (editando) {
        const res = await actualizarFranja(editando.id, dias, desde, hasta);
        if (!res.ok) { setError(res.error); return; }
        setItems(prev => prev.map(f => f.id === editando.id ? res.data : f));
      } else {
        const res = await crearFranja(dias, desde, hasta);
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

      {/* Anticipación mínima: las fechas más cercanas se grisan para el socio */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div>
          <p className="text-foreground font-medium text-sm">Anticipación mínima de entrega</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Horas entre que el socio confirma el pedido y la primera franja que puede elegir.
            Con 48, si pide un lunes la primera entrega posible es el miércoles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number" min="0" step="1" value={anticipacion}
            onChange={e => setAnticipacion(e.target.value)}
            className="input-club w-28 text-center text-lg font-bold text-club-dorado"
          />
          <span className="text-muted-foreground text-sm">horas</span>
          <button onClick={guardarAnticipacion} disabled={pending || anticipacion === String(config.entrega_anticipacion_horas)}
            className="ml-auto px-4 py-2 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-sm font-semibold hover:bg-club-dorado/25 transition-colors disabled:opacity-40">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : anticipacionOk ? <Check className="w-4 h-4" /> : 'Guardar'}
          </button>
        </div>
      </motion.div>

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
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Días *</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 0].map(d => (
                      <button key={d} type="button" onClick={() => toggleDia(d)}
                        className={cn(
                          'w-11 py-2 rounded-lg text-xs font-semibold border transition-all',
                          dias.includes(d)
                            ? 'bg-club-dorado text-club-verde border-club-dorado'
                            : 'bg-white/5 text-muted-foreground border-white/10 hover:border-club-dorado/40'
                        )}>
                        {DIAS_CORTOS[d]}
                      </button>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-1.5">{labelDias(dias)}</p>
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
  const [upsellTitulo, setUpsellTitulo] = useState(config.upsell_titulo);
  const [upsellTexto, setUpsellTexto]   = useState(config.upsell_texto);
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
        guardarConfigApp('upsell_titulo',           upsellTitulo.trim() || 'Sumá productos a tu pedido'),
        guardarConfigApp('upsell_texto',            upsellTexto.trim()),
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

      {/* Paso "Sumá productos" al cerrar el carrito */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div>
          <p className="text-foreground font-medium text-sm">Oferta de productos destacados</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Al tocar "Continuar pedido", el socio ve los productos marcados como destacados en Admin → Productos.
            Estos son el título y la bajada de ese paso.
          </p>
        </div>
        <input
          value={upsellTitulo} onChange={e => setUpsellTitulo(e.target.value)}
          className="input-club w-full" placeholder="Sumá productos a tu pedido"
        />
        <textarea
          value={upsellTexto} onChange={e => setUpsellTexto(e.target.value)} rows={2}
          className="input-club w-full resize-none" placeholder="Bajada opcional"
        />
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
