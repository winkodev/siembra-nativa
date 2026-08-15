'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  User, Phone, MapPin, FileText, ShieldCheck, ShieldOff,
  UserCheck, UserX, Store, X, ChevronRight, ExternalLink,
  Loader2, AlertCircle, Clock, Search, Users,
  ShoppingBag, Leaf, Scale, CalendarDays, Plus, Trash2, NotebookPen,
} from 'lucide-react';
import type { Profile, FichaSocio, TipoNotaSocio } from '@/lib/types/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn, formatFecha, formatGramos } from '@/lib/utils';
import {
  toggleEstadoSocio,
  aprobarReprocann,
  rechazarReprocann,
  obtenerCertificadoUrl,
  obtenerFichaSocio,
  agregarNotaSocio,
  eliminarNotaSocio,
} from '@/app/actions/socios';

type LoadingKey = `reprocann-${string}` | `estado-${string}` | `notas-${string}` | `cert-${string}`;

// Tipos de nota del log interno
const TIPO_NOTA: Record<TipoNotaSocio, { label: string; color: string }> = {
  general:         { label: 'General',         color: 'text-gray-300 bg-gray-500/10 border-gray-500/30' },
  consulta_medica: { label: 'Consulta médica', color: 'text-blue-300 bg-blue-400/10 border-blue-400/30' },
  reprocann:       { label: 'REPROCANN',       color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  pago:            { label: 'Pago',            color: 'text-club-dorado bg-club-dorado/10 border-club-dorado/30' },
};

interface Props { socios: Profile[] }

const REPROCANN_LABEL: Record<string, { label: string; color: string }> = {
  pendiente:  { label: 'Pendiente',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  aprobado:   { label: 'Aprobado',   color: 'text-green-400  bg-green-400/10  border-green-400/30'  },
  rechazado:  { label: 'Rechazado',  color: 'text-red-400    bg-red-400/10    border-red-400/30'    },
  vencido:    { label: 'Vencido',    color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
};

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  activo:   { label: 'Activo',    color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  inactivo: { label: 'Inactivo',  color: 'text-red-400   bg-red-400/10   border-red-400/30'   },
};

const CATEGORIA_LABEL: Record<string, string> = {
  paciente_cultiva:   'Paciente cultivador',
  tercero_cultivador: 'Tercero cultivador',
  ong:                'ONG',
};

const filtrosReprocann = [
  { label: 'Todos',     value: 'todos'     },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Aprobado',  value: 'aprobado'  },
  { label: 'Rechazado', value: 'rechazado' },
];

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {text}
    </span>
  );
}

// ------------------------------------------------------------------
// Drawer lateral de detalle del socio
// ------------------------------------------------------------------
function SocioDrawer({
  socio: initial,
  onClose,
}: {
  socio: Profile;
  onClose: (updated?: Profile) => void;
}) {
  const [socio, setSocio] = useState<Profile>(initial);
  const [loading, setLoading] = useState<LoadingKey | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  // Ficha de actividad + log de notas (se carga al abrir el drawer)
  const [ficha, setFicha]         = useState<FichaSocio | null>(null);
  const [fichaError, setFichaError] = useState<string | null>(null);
  const [nuevaNota, setNuevaNota] = useState('');
  const [tipoNota, setTipoNota]   = useState<TipoNotaSocio>('general');

  useEffect(() => {
    let vigente = true;
    obtenerFichaSocio(initial.id).then(res => {
      if (!vigente) return;
      if (res.ok) setFicha(res.data);
      else setFichaError(res.error);
    });
    return () => { vigente = false; };
  }, [initial.id]);

  async function run(key: LoadingKey, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoading(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Error desconocido');
    } finally {
      setLoading(null);
    }
  }

  const busy = (key: LoadingKey) => loading === key;

  async function handleAprobar() {
    await run(`reprocann-${socio.id}`, async () => {
      const res = await aprobarReprocann(socio.id);
      if (res.ok) setSocio(s => ({ ...s, reprocann_estado: 'aprobado', compra_habilitada: true }));
      return res;
    });
  }

  async function handleRevocar() {
    await run(`reprocann-${socio.id}`, async () => {
      const res = await rechazarReprocann(socio.id);
      if (res.ok) setSocio(s => ({ ...s, reprocann_estado: 'rechazado', compra_habilitada: false }));
      return res;
    });
  }

  async function handleToggleEstado() {
    const nuevo = socio.estado === 'activo' ? 'inactivo' : 'activo';
    await run(`estado-${socio.id}`, async () => {
      const res = await toggleEstadoSocio(socio.id, nuevo);
      if (res.ok) setSocio(s => ({
        ...s,
        estado: nuevo,
        compra_habilitada: nuevo === 'inactivo' ? false : s.compra_habilitada,
      }));
      return res;
    });
  }

  async function handleAgregarNota() {
    if (!nuevaNota.trim()) return;
    await run(`notas-${socio.id}`, async () => {
      const res = await agregarNotaSocio(socio.id, tipoNota, nuevaNota);
      if (res.ok) {
        setFicha(f => f ? { ...f, notas: [res.data, ...f.notas] } : f);
        setNuevaNota('');
        setTipoNota('general');
      }
      return res;
    });
  }

  async function handleEliminarNota(notaId: string) {
    await run(`notas-${socio.id}`, async () => {
      const res = await eliminarNotaSocio(notaId);
      if (res.ok) setFicha(f => f ? { ...f, notas: f.notas.filter(n => n.id !== notaId) } : f);
      return res;
    });
  }

  async function handleCertificado() {
    if (!socio.reprocann_certificado_path) return;
    setCertLoading(true);
    setError(null);
    try {
      const res = await obtenerCertificadoUrl(socio.id, socio.reprocann_certificado_path);
      if (res.ok) window.open(res.data.url, '_blank', 'noopener,noreferrer');
      else setError(res.error);
    } finally {
      setCertLoading(false);
    }
  }

  const rep = REPROCANN_LABEL[socio.reprocann_estado] ?? REPROCANN_LABEL.pendiente;
  const est = ESTADO_LABEL[socio.estado] ?? ESTADO_LABEL.activo;
  const repKey = `reprocann-${socio.id}` as LoadingKey;
  const estKey = `estado-${socio.id}` as LoadingKey;
  const notKey = `notas-${socio.id}` as LoadingKey;

  const direccionCompleta = [socio.direccion, socio.localidad, socio.provincia, socio.codigo_postal]
    .filter(Boolean).join(', ') || null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => onClose(socio)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col bg-[#083D3A] border-l border-white/10 shadow-2xl">

        {/* Header fijo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-club-dorado/10 border border-club-dorado/30 flex items-center justify-center shrink-0">
              <span className="text-club-dorado text-sm font-semibold">
                {socio.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{socio.nombre}</p>
              <p className="text-xs text-muted-foreground truncate">{socio.email ?? '—'}</p>
            </div>
          </div>
          <button
            onClick={() => onClose(socio)}
            className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Datos personales */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Datos personales</p>
            <div className="rounded-xl bg-white/5 p-3 space-y-1.5 text-sm">
              {socio.dni && (
                <div className="flex gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">DNI:</span>
                  <span className="text-foreground font-medium">{socio.dni}</span>
                </div>
              )}
              {socio.telefono && (
                <div className="flex gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Tel:</span>
                  <span className="text-foreground font-medium">{socio.telefono}</span>
                </div>
              )}
              {direccionCompleta && (
                <div className="flex gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium">{direccionCompleta}</span>
                </div>
              )}
              {socio.fecha_alta && (
                <div className="flex gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Alta:</span>
                  <span className="text-foreground font-medium">{new Date(socio.fecha_alta).toLocaleDateString('es-AR')}</span>
                </div>
              )}
              {!socio.dni && !socio.telefono && !socio.direccion && (
                <p className="text-muted-foreground italic text-xs">Sin datos adicionales</p>
              )}
            </div>
          </section>

          {/* REPROCANN */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">REPROCANN</p>
            <div className="rounded-xl bg-white/5 p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge text={rep.label} color={rep.color} />
                {socio.reprocann_vencimiento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(socio.reprocann_vencimiento).toLocaleDateString('es-AR')}
                  </span>
                )}
              </div>

              {(socio.reprocann_numero || socio.reprocann_categoria) && (
                <div className="text-sm space-y-1">
                  {socio.reprocann_numero && (
                    <p className="text-muted-foreground">
                      N°: <span className="text-foreground font-medium">{socio.reprocann_numero}</span>
                    </p>
                  )}
                  {socio.reprocann_categoria && (
                    <p className="text-muted-foreground">
                      Cat: <span className="text-foreground font-medium">{CATEGORIA_LABEL[socio.reprocann_categoria]}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Certificado */}
              {socio.reprocann_certificado_path ? (
                <button
                  onClick={handleCertificado}
                  disabled={certLoading}
                  className="flex items-center gap-2 text-sm text-club-dorado hover:text-club-dorado/80 transition-colors disabled:opacity-50"
                >
                  {certLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Ver certificado
                </button>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin certificado</p>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 flex-wrap pt-1">
                {socio.reprocann_estado !== 'aprobado' ? (
                  <button
                    onClick={handleAprobar}
                    disabled={busy(repKey)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 transition-colors disabled:opacity-50"
                  >
                    {busy(repKey) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Aprobar
                  </button>
                ) : (
                  <button
                    onClick={handleRevocar}
                    disabled={busy(repKey)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                  >
                    {busy(repKey) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                    Revocar
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Estado socio + Tienda en fila */}
          <section className="grid grid-cols-2 gap-3">
            {/* Estado */}
            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Socio</p>
              <Badge text={est.label} color={est.color} />
              <button
                onClick={handleToggleEstado}
                disabled={busy(estKey)}
                className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                  socio.estado === 'activo'
                    ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/30 text-red-400'
                    : 'bg-green-500/15 hover:bg-green-500/25 border-green-500/30 text-green-400'
                }`}
              >
                {busy(estKey) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : socio.estado === 'activo' ? (
                  <UserX className="w-3.5 h-3.5" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                {socio.estado === 'activo' ? 'Desactivar' : 'Activar'}
              </button>
            </div>

            {/* Tienda */}
            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tienda</p>
              <Store className={`w-5 h-5 ${socio.compra_habilitada ? 'text-green-400' : 'text-muted-foreground'}`} />
              <p className={`text-xs font-medium ${socio.compra_habilitada ? 'text-green-400' : 'text-muted-foreground'}`}>
                {socio.compra_habilitada ? 'Habilitada' : 'Deshabilitada'}
              </p>
              <p className="text-xs text-muted-foreground/60">Auto por REPROCANN</p>
            </div>
          </section>

          {/* Actividad del socio */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Actividad</p>
            {fichaError ? (
              <p className="text-xs text-red-400">{fichaError}</p>
            ) : !ficha ? (
              <div className="rounded-xl bg-white/5 p-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-club-dorado" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <ShoppingBag className="w-3.5 h-3.5 text-club-dorado mb-1" />
                  <p className="text-foreground font-bold text-base leading-none">{ficha.pedidos_total}</p>
                  <p className="text-muted-foreground text-[11px] mt-1">
                    Pedidos ({ficha.pedidos_entregados} entregado{ficha.pedidos_entregados !== 1 ? 's' : ''})
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <Leaf className="w-3.5 h-3.5 text-club-dorado mb-1" />
                  <p className="text-foreground font-bold text-base leading-none">{formatGramos(ficha.gramos_retirados)}</p>
                  <p className="text-muted-foreground text-[11px] mt-1">
                    Retirados{ficha.unidades_retiradas > 0 ? ` + ${ficha.unidades_retiradas} u.` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <Scale className="w-3.5 h-3.5 text-club-dorado mb-1" />
                  <p className="text-foreground font-bold text-base leading-none">{formatGramos(ficha.promedio_gramos)}</p>
                  <p className="text-muted-foreground text-[11px] mt-1">Promedio por entrega</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <CalendarDays className="w-3.5 h-3.5 text-club-dorado mb-1" />
                  <p className="text-foreground font-bold text-base leading-none">
                    {ficha.ultimo_pedido ? formatFecha(ficha.ultimo_pedido) : '—'}
                  </p>
                  <p className="text-muted-foreground text-[11px] mt-1">Último pedido</p>
                </div>
              </div>
            )}
          </section>

          {/* Log de notas internas */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <NotebookPen className="w-3.5 h-3.5" /> Notas internas
            </p>

            {/* Alta de nota */}
            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <div className="flex gap-1 flex-wrap">
                {(Object.keys(TIPO_NOTA) as TipoNotaSocio[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTipoNota(t)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                      tipoNota === t
                        ? TIPO_NOTA[t].color
                        : 'text-muted-foreground/60 border-white/10 hover:text-muted-foreground'
                    )}
                  >
                    {TIPO_NOTA[t].label}
                  </button>
                ))}
              </div>
              <textarea
                value={nuevaNota}
                onChange={e => setNuevaNota(e.target.value)}
                placeholder="Ej: consulta médica del 14/08, ajuste de dosis..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-club-dorado/40 transition-colors"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAgregarNota}
                  disabled={busy(notKey) || !nuevaNota.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-club-dorado/15 hover:bg-club-dorado/25 border border-club-dorado/30 text-club-dorado transition-colors disabled:opacity-50"
                >
                  {busy(notKey) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Agregar nota
                </button>
              </div>
            </div>

            {/* Historial */}
            {ficha && ficha.notas.length > 0 && (
              <div className="space-y-2">
                {ficha.notas.map(n => (
                  <div key={n.id} className="rounded-xl bg-white/5 p-3 group">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge text={TIPO_NOTA[n.tipo]?.label ?? n.tipo} color={TIPO_NOTA[n.tipo]?.color ?? TIPO_NOTA.general.color} />
                        <span className="text-[11px] text-muted-foreground">
                          {formatFecha(n.created_at, "dd MMM yyyy · HH:mm")}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEliminarNota(n.id)}
                        disabled={busy(notKey)}
                        className="p-1 rounded text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Eliminar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.contenido}</p>
                  </div>
                ))}
              </div>
            )}
            {ficha && ficha.notas.length === 0 && (
              <p className="text-xs text-muted-foreground italic px-1">Sin notas todavía.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Página principal
// ------------------------------------------------------------------
export function AdminSociosClient({ socios: initialSocios }: Props) {
  const [socios, setSocios] = useState<Profile[]>(initialSocios);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [search, setSearch] = useState('');
  const [filtroRep, setFiltroRep] = useState('todos');

  // Abrir el drawer del socio si se llega con ?socio=<id> (deep-link desde el dashboard)
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('socio');
    if (id) {
      const s = initialSocios.find(x => x.id === id);
      if (s) setSelected(s);
    }
  }, [searchParams, initialSocios]);

  function handleClose(updated?: Profile) {
    if (updated) setSocios(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(null);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return socios.filter(s => {
      if (filtroRep !== 'todos' && s.reprocann_estado !== filtroRep) return false;
      return !q
        || s.nombre.toLowerCase().includes(q)
        || (s.email ?? '').toLowerCase().includes(q)
        || (s.dni ?? '').includes(q);
    });
  }, [socios, search, filtroRep]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Users className="w-5 h-5" />}
        title="Socios"
        subtitle={`${socios.length} socio${socios.length !== 1 ? 's' : ''} registrado${socios.length !== 1 ? 's' : ''}`}
      />

      {/* Toolbar: búsqueda + filtro REPROCANN */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o DNI..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit overflow-x-auto">
          {filtrosReprocann.map(f => {
            const count = f.value === 'todos'
              ? socios.length
              : socios.filter(s => s.reprocann_estado === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFiltroRep(f.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  filtroRep === f.value
                    ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            {socios.length === 0 ? 'No hay socios registrados.' : 'Sin resultados para este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(socio => {
            const rep = REPROCANN_LABEL[socio.reprocann_estado] ?? REPROCANN_LABEL.pendiente;
            const est = ESTADO_LABEL[socio.estado] ?? ESTADO_LABEL.activo;
            return (
              <button
                key={socio.id}
                onClick={() => setSelected(socio)}
                className="w-full text-left glass-card rounded-xl px-4 py-3.5 flex items-center gap-4 border border-transparent hover:border-club-dorado/25 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-club-dorado/10 border border-club-dorado/25 flex items-center justify-center shrink-0">
                  <span className="text-club-dorado text-sm font-bold">
                    {socio.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{socio.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{socio.email ?? '—'}</p>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <Badge text={rep.label} color={rep.color} />
                  <Badge text={est.label} color={est.color} />
                  {socio.compra_habilitada && <Store className="w-3.5 h-3.5 text-green-400" />}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-club-dorado transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {selected && <SocioDrawer socio={selected} onClose={handleClose} />}
    </div>
  );
}
