'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, Ban, ChevronDown, Leaf, Pencil, Plus, TrendingUp, Undo2, Users, X } from 'lucide-react';
import { cn, formatFecha, formatGramos, formatPrecio } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal, Campo, BotonGuardar } from '@/components/admin/ModalForm';
import { GestionTabs } from '../GestionTabs';
import {
  crearPersonal, editarPersonal, aplicarAumento, quitarUltimoAumento, anularPago, registrarRetiro, anularRetiro,
} from '@/app/actions/personal';
import { etiquetaPeriodo, hoyAR, liquidacion, primerDia, primerSueldo, retirosPendientes, sueldoEn, type PersonalVista } from '@/lib/personal';
import type { ActionResponse, TipoPersonal } from '@/lib/types/database';

export interface GeneticaRetiro { genetica_id: string; nombre: string; stock_total_gramos: number; precio_gramo: number | null }

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const select  = 'input-club w-full bg-club-verde-medio appearance-none cursor-pointer';
const TIPO_LABEL: Record<TipoPersonal, string> = { empleado: 'Empleado', socio_admin: 'Socio administrador' };

interface Props {
  personal:  PersonalVista[];
  admins:    { id: string; nombre: string }[];
  geneticas: GeneticaRetiro[];
  errorMsg:  string | null;
}
type ModalTipo = { k: 'alta' } | { k: 'editar'; p: PersonalVista } | { k: 'aumento' } | { k: 'retiro'; id?: string }
  | { k: 'confirmar'; titulo: string; texto: string; accion: () => Promise<ActionResponse> } | null;

export function PersonalClient({ personal, admins, geneticas, errorMsg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalTipo>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => { setModal(null); router.refresh(); };
  const libres = admins.filter(a => !personal.some(p => p.profile_id === a.id));
  const activos = personal.filter(p => p.activo);
  const empleados = activos.filter(p => p.tipo === 'empleado');
  const mes = primerDia(hoyAR());

  const ejecutar = (accion: () => Promise<ActionResponse>) => startTransition(async () => {
    const r = await accion();
    if (!r.ok) setError(r.error); else setError(null);
    cerrar();
  });

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<Users className="w-5 h-5" />} title="Gestión" subtitle="Personal, sueldos y retiros · solo superadmin"
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModal({ k: 'retiro' })} disabled={activos.length === 0} className="btn-secondary text-sm px-4 py-2.5 flex items-center gap-2 disabled:opacity-40"><Leaf className="w-4 h-4" /> Retiro</button>
            <button onClick={() => setModal({ k: 'aumento' })} disabled={empleados.length === 0} className="btn-secondary text-sm px-4 py-2.5 flex items-center gap-2 disabled:opacity-40"><TrendingUp className="w-4 h-4" /> Aumento</button>
            <button onClick={() => setModal({ k: 'alta' })} disabled={Boolean(errorMsg)} className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar</button>
          </div>
        } />
      <GestionTabs />

      {errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{errorMsg}</p></motion.div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>
      )}
      {personal.length === 0 && !errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center text-muted-foreground text-sm">Todavía no hay personal cargado.</motion.div>
      )}

      {personal.map(p => {
        const esEmpleado = p.tipo === 'empleado';
        const l = esEmpleado ? liquidacion(p, 'sueldo', mes) : null;
        const retPend = retirosPendientes(p);
        const debe = p.retiros.filter(r => !r.anulado_at && r.deuda_id).reduce((a, r) => a + r.pendiente, 0);
        const abierto = abierta === p.id;
        return (
          <motion.div key={p.id} variants={fadeUp} className={cn('glass-card overflow-hidden', !p.activo && 'opacity-60')}>
            <div className="p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-foreground font-semibold">{p.nombre}{!p.activo && <span className="ml-2 text-[10px] text-muted-foreground">de baja</span>}</p>
                <p className="text-muted-foreground text-xs">{[TIPO_LABEL[p.tipo], p.cargo, `desde ${formatFecha(p.fecha_ingreso)}`].filter(Boolean).join(' · ')}</p>
              </div>
              {l ? (
                <>
                  <Dato label="Sueldo" valor={formatPrecio(sueldoEn(p, mes) ?? primerSueldo(p)?.monto ?? 0)} />
                  <Dato label="Retiros a descontar" valor={formatPrecio(retPend)} color={retPend > 0 ? 'text-amber-300' : undefined} />
                  <Dato label="Falta pagar este mes" valor={formatPrecio(Math.max(l.falta - retPend, 0))} color={l.falta > 0 ? 'text-club-dorado' : 'text-emerald-400'} />
                </>
              ) : (
                <Dato label="Le debe al club" valor={formatPrecio(debe)} color={debe > 0 ? 'text-amber-300' : undefined} />
              )}
              <div className="flex gap-1">
                {p.activo && <button onClick={() => setModal({ k: 'retiro', id: p.id })} title="Registrar retiro" className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><Leaf className="w-4 h-4" /></button>}
                <button onClick={() => setModal({ k: 'editar', p })} title="Editar" className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setAbierta(abierto ? null : p.id)} title="Ver historial" className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><ChevronDown className={cn('w-4 h-4 transition-transform', abierto && 'rotate-180')} /></button>
              </div>
            </div>

            {abierto && (
              <div className="border-t border-club-verde-claro/15 p-4 grid gap-5 lg:grid-cols-3">
                {esEmpleado && (
                  <Lista titulo="Sueldos" vacio={p.sueldos.length === 0}>
                    {p.sueldos.map((s, i) => (
                      <Fila key={s.id} titulo={formatPrecio(s.monto)} detalle={`desde ${formatFecha(s.desde, 'MMM yyyy')}${s.porcentaje != null ? ` · +${s.porcentaje}%` : ' · inicial'}`}
                        accion={i === 0 && s.porcentaje != null
                          ? { icono: <Undo2 className="w-3.5 h-3.5" />, titulo: 'Quitar este aumento', onClick: () => setModal({ k: 'confirmar', titulo: 'Quitar aumento', texto: `${p.nombre} vuelve al sueldo anterior.`, accion: () => quitarUltimoAumento(p.id) }) }
                          : undefined} />
                    ))}
                  </Lista>
                )}
                {esEmpleado && (
                  <Lista titulo="Pagos" vacio={p.pagos.length === 0}>
                    {[...p.pagos].reverse().map(g => (
                      <Fila key={g.id} anulado={Boolean(g.anulado_at)} titulo={`${etiquetaPeriodo(g.tipo, g.periodo)} · ${formatPrecio(g.monto)}`}
                        detalle={[`${formatFecha(g.fecha)}`, `base ${formatPrecio(g.base)}`, g.extra > 0 && `extra ${formatPrecio(g.extra)}`, g.retiros > 0 && `retiros ${formatPrecio(g.retiros)}`, g.nota].filter(Boolean).join(' · ')}
                        accion={g.anulado_at ? undefined : { icono: <Ban className="w-3.5 h-3.5" />, titulo: 'Anular pago', onClick: () => setModal({ k: 'confirmar', titulo: 'Anular pago', texto: `Se devuelven ${formatPrecio(g.monto)} a la cuenta y se reabren los retiros descontados.`, accion: () => anularPago(g.id) }) }} />
                    ))}
                  </Lista>
                )}
                <Lista titulo="Retiros" vacio={p.retiros.length === 0}>
                  {p.retiros.map(r => (
                    <Fila key={r.id} anulado={Boolean(r.anulado_at)} titulo={`${formatGramos(r.gramos)} ${r.genetica} · ${formatPrecio(r.total)}`}
                      detalle={[formatFecha(r.fecha), `${formatPrecio(r.precio_gramo)} por gramo`,
                        r.pendiente === 0 ? (r.deuda_id ? 'cobrado' : 'descontado') : r.cubierto > 0 ? `quedan ${formatPrecio(r.pendiente)}` : null, r.nota].filter(Boolean).join(' · ')}
                      accion={r.anulado_at || r.cubierto > 0 ? undefined : { icono: <Ban className="w-3.5 h-3.5" />, titulo: 'Anular retiro', onClick: () => setModal({ k: 'confirmar', titulo: 'Anular retiro', texto: `Vuelven ${formatGramos(r.gramos)} de ${r.genetica} al stock.`, accion: () => anularRetiro(r.id) }) }} />
                  ))}
                </Lista>
              </div>
            )}
          </motion.div>
        );
      })}

      {modal?.k === 'alta' && <AltaModal admins={libres} onClose={cerrar} />}
      {modal?.k === 'editar' && <EditarModal p={modal.p} onClose={cerrar} />}
      {modal?.k === 'aumento' && <AumentoModal empleados={empleados} onClose={cerrar} />}
      {modal?.k === 'retiro' && <RetiroModal personal={activos} personaInicial={modal.id} geneticas={geneticas} onClose={cerrar} />}
      {modal?.k === 'confirmar' && (
        <Modal titulo={modal.titulo} icono={<Ban className="w-5 h-5 text-red-400" />} onClose={() => setModal(null)}>
          <p className="text-sm text-foreground">{modal.texto}</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button disabled={pending} onClick={() => ejecutar(modal.accion)} className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold disabled:opacity-50">{modal.titulo}</button>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}

function Dato({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('font-bold tabular-nums', color ?? 'text-foreground')}>{valor}</p>
    </div>
  );
}
function Lista({ titulo, vacio, children }: { titulo: string; vacio: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{titulo}</p>
      {vacio ? <p className="text-xs text-muted-foreground py-2">Sin registros.</p> : <div className="divide-y divide-club-verde-claro/10 max-h-80 overflow-y-auto">{children}</div>}
    </div>
  );
}
function Fila({ titulo, detalle, anulado, accion }: { titulo: string; detalle: string; anulado?: boolean; accion?: { icono: React.ReactNode; titulo: string; onClick: () => void } }) {
  return (
    <div className={cn('py-2 flex items-start gap-2', anulado && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-foreground', anulado && 'line-through')}>{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalle}{anulado && ' · anulado'}</p>
      </div>
      {accion && <button onClick={accion.onClick} title={accion.titulo} className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400">{accion.icono}</button>}
    </div>
  );
}

// ── Modales ──────────────────────────────────────────────────

// Estado común: envío, error y cierre
function useEnvio(onClose: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async (accion: () => Promise<ActionResponse>) => {
    setPending(true); setError(null);
    const r = await accion();
    setPending(false);
    if (!r.ok) { setError(r.error); return; }
    onClose();
  };
  return { pending, error, enviar };
}
function Pie({ pending, error, label, onClose }: { pending: boolean; error: string | null; label: string; onClose: () => void }) {
  return (
    <>
      {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
        <BotonGuardar pending={pending} label={label} />
      </div>
    </>
  );
}

function AltaModal({ admins, onClose }: { admins: { id: string; nombre: string }[]; onClose: () => void }) {
  const [perfil, setPerfil] = useState('');
  const [tipo, setTipo] = useState<TipoPersonal>('empleado');
  const [cargo, setCargo] = useState('');
  const [ingreso, setIngreso] = useState(hoyAR());
  const [sueldo, setSueldo] = useState('');
  const [primerMes, setPrimerMes] = useState(hoyAR().slice(0, 7));
  const { pending, error, enviar } = useEnvio(onClose);

  return (
    <Modal titulo="Agregar persona" icono={<Users className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); enviar(() => crearPersonal({ profile_id: perfil, tipo, cargo, fecha_ingreso: ingreso, primer_mes: primerMes, sueldo: tipo === 'empleado' ? parseFloat(sueldo) || 0 : undefined })); }} className="space-y-3">
        <Campo label="Usuario admin *">
          <select value={perfil} onChange={e => setPerfil(e.target.value)} className={select} required>
            <option value="" disabled>Elegí</option>
            {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoPersonal)} className={select}>
            <option value="empleado">Empleado</option>
            <option value="socio_admin">Socio administrador, sin sueldo</option>
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cargo"><input value={cargo} onChange={e => setCargo(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
          <Campo label="Fecha de ingreso *"><input type="date" value={ingreso} onChange={e => setIngreso(e.target.value)} className="input-club w-full" required /></Campo>
        </div>
        {tipo === 'empleado' && <Campo label="Primer sueldo a pagar *"><input type="month" min={ingreso.slice(0, 7)} value={primerMes} onChange={e => setPrimerMes(e.target.value)} className="input-club w-full" required /></Campo>}
        {tipo === 'empleado' && <Campo label="Sueldo base por mes *"><input type="number" min="1" step="0.01" value={sueldo} onChange={e => setSueldo(e.target.value)} className="input-club w-full" required /></Campo>}
        <Pie pending={pending} error={error} label="Agregar" onClose={onClose} />
      </form>
    </Modal>
  );
}

function EditarModal({ p, onClose }: { p: PersonalVista; onClose: () => void }) {
  const [cargo, setCargo] = useState(p.cargo ?? '');
  const [ingreso, setIngreso] = useState(p.fecha_ingreso);
  const [activo, setActivo] = useState(p.activo);
  const [primerMes, setPrimerMes] = useState(primerSueldo(p)?.desde.slice(0, 7) ?? p.fecha_ingreso.slice(0, 7));
  const [sueldo, setSueldo] = useState(String(p.sueldos[0]?.monto ?? ''));
  const { pending, error, enviar } = useEnvio(onClose);
  // Después del primer aumento o pago, el sueldo solo cambia con aumentos
  const corregible = p.tipo === 'empleado' && p.sueldos.length === 1 && !p.pagos.some(g => !g.anulado_at);

  return (
    <Modal titulo={p.nombre} icono={<Pencil className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); enviar(() => editarPersonal(p.id, { cargo, fecha_ingreso: ingreso, primer_mes: primerMes, activo, sueldo: corregible ? parseFloat(sueldo) || 0 : undefined })); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cargo"><input value={cargo} onChange={e => setCargo(e.target.value)} className="input-club w-full" /></Campo>
          <Campo label="Fecha de ingreso *"><input type="date" value={ingreso} onChange={e => setIngreso(e.target.value)} className="input-club w-full" required /></Campo>
        </div>
        {p.tipo === 'empleado' && <Campo label="Primer sueldo a pagar *"><input type="month" min={ingreso.slice(0, 7)} value={primerMes} onChange={e => setPrimerMes(e.target.value)} className="input-club w-full" required /></Campo>}
        {corregible && <Campo label="Sueldo base por mes *"><input type="number" min="1" step="0.01" value={sueldo} onChange={e => setSueldo(e.target.value)} className="input-club w-full" required /></Campo>}
        <label className="flex items-center gap-2 text-sm text-foreground/80"><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Activo. Desmarcá para dar de baja; conserva su historial.</label>
        <Pie pending={pending} error={error} label="Guardar" onClose={onClose} />
      </form>
    </Modal>
  );
}

function AumentoModal({ empleados, onClose }: { empleados: PersonalVista[]; onClose: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [pct, setPct] = useState('');
  const [mes, setMes] = useState(hoyAR().slice(0, 7));
  const { pending, error, enviar } = useEnvio(onClose);
  const porcentaje = parseFloat(pct) || 0;
  const nuevo = (n: number) => Math.round(n * (1 + porcentaje / 100));
  const elegidos = empleados.filter(p => ids.includes(p.id));
  const actual = elegidos.reduce((a, p) => a + (p.sueldos[0]?.monto ?? 0), 0);
  const total = elegidos.reduce((a, p) => a + nuevo(p.sueldos[0]?.monto ?? 0), 0);

  return (
    <Modal titulo="Aumento" icono={<TrendingUp className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); enviar(() => aplicarAumento(ids, porcentaje, mes)); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Porcentaje *"><input type="number" min="0.01" step="0.01" value={pct} onChange={e => setPct(e.target.value)} className="input-club w-full" placeholder="10" required /></Campo>
          <Campo label="Desde el sueldo de *"><input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input-club w-full" required /></Campo>
        </div>
        <div className="divide-y divide-club-verde-claro/10">
          {empleados.map(p => {
            const s = p.sueldos[0]?.monto ?? 0;
            const marcado = ids.includes(p.id);
            return (
              <label key={p.id} className="py-2 flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={marcado} onChange={() => setIds(v => marcado ? v.filter(x => x !== p.id) : [...v, p.id])} />
                <span className="flex-1 text-sm text-foreground">{p.nombre}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatPrecio(s)}</span>
                {porcentaje > 0 && <span className="text-sm text-club-dorado font-semibold tabular-nums">{formatPrecio(nuevo(s))}</span>}
              </label>
            );
          })}
        </div>
        {elegidos.length > 0 && porcentaje > 0 && (
          <p className="text-sm text-foreground flex justify-between border-t border-white/10 pt-2">
            <span>Total por mes</span><span className="tabular-nums">{formatPrecio(actual)} <span className="text-club-dorado font-bold ml-2">{formatPrecio(total)}</span></span>
          </p>
        )}
        <Pie pending={pending || ids.length === 0} error={error} label="Aplicar aumento" onClose={onClose} />
      </form>
    </Modal>
  );
}

function RetiroModal({ personal, personaInicial, geneticas, onClose }: { personal: PersonalVista[]; personaInicial?: string; geneticas: GeneticaRetiro[]; onClose: () => void }) {
  const [personaId, setPersonaId] = useState(personaInicial ?? '');
  const [geneticaId, setGeneticaId] = useState('');
  const [gramos, setGramos] = useState('');
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState(hoyAR());
  const [nota, setNota] = useState('');
  const { pending, error, enviar } = useEnvio(onClose);
  const p = personal.find(x => x.id === personaId);
  const g = geneticas.find(x => x.genetica_id === geneticaId);
  const total = (parseFloat(gramos) || 0) * (parseFloat(precio) || 0);

  return (
    <Modal titulo="Retiro de flores" icono={<Leaf className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); enviar(() => registrarRetiro({ personal_id: personaId, nombre: p?.nombre ?? '', genetica_id: geneticaId, gramos: parseFloat(gramos) || 0, precio: parseFloat(precio) || 0, fecha, nota })); }} className="space-y-3">
        <Campo label="Quién retira *">
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} className={select} required>
            <option value="" disabled>Elegí</option>
            {personal.map(x => <option key={x.id} value={x.id}>{x.nombre} · {TIPO_LABEL[x.tipo]}</option>)}
          </select>
        </Campo>
        <Campo label="Genética *">
          <select value={geneticaId} onChange={e => { setGeneticaId(e.target.value); setPrecio(String(geneticas.find(x => x.genetica_id === e.target.value)?.precio_gramo ?? '')); }} className={select} required>
            <option value="" disabled>Elegí</option>
            {geneticas.map(x => <option key={x.genetica_id} value={x.genetica_id}>{x.nombre} · {formatGramos(x.stock_total_gramos)}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Gramos *"><input type="number" min="0.01" step="0.01" max={g?.stock_total_gramos} value={gramos} onChange={e => setGramos(e.target.value)} className="input-club w-full" required /></Campo>
          <Campo label="Precio por gramo *"><input type="number" min="0.01" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} className="input-club w-full" required /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-club w-full" required /></Campo>
          <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        </div>
        {p && total > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="text-club-dorado font-bold">{formatPrecio(total)}</span> {p.tipo === 'empleado' ? 'a descontar de su sueldo.' : 'queda como deuda con el club.'}
          </p>
        )}
        <Pie pending={pending} error={error} label="Registrar retiro" onClose={onClose} />
      </form>
    </Modal>
  );
}
