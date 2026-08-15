'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronDown, Clock, Loader2, Search, Receipt, ExternalLink, Printer, CalendarClock } from 'lucide-react';
import { cn, formatFecha, formatGramos, formatNumeroPedido, labelTipo, labelCategoriaProducto, badgePedido } from '@/lib/utils';
import { cambiarEstadoPedido, verComprobante } from '@/app/actions/pedidos';
import { PageHeader } from '@/components/layout/PageHeader';
import type { EstadoPedido } from '@/lib/types/database';

const labelEstado: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Transiciones de estado permitidas
type EstadoDestino = Exclude<EstadoPedido, 'pendiente'>;
const transiciones: Record<EstadoPedido, EstadoDestino[]> = {
  pendiente: ['aprobado', 'cancelado'],
  aprobado:  ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

interface PedidoItemAdmin {
  id: string;
  cantidad_gramos: number | null;
  cantidad_unidades: number | null;
  geneticas: { nombre: string; tipo: string } | null;
  productos: { nombre: string; categoria: string } | null;
}

interface PedidoAdmin {
  id: string;
  numero: number | null;
  estado: EstadoPedido;
  created_at: string;
  notas: string | null;
  comprobante_path: string | null;
  comprobante_subido_at: string | null;
  entrega_franja: string | null;
  pedido_items: PedidoItemAdmin[];
  profiles: { nombre: string; dni: string | null } | null;
}

// Datos de presentación de un item, sea genética (gramos) o producto (unidades)
function itemDisplay(item: PedidoItemAdmin) {
  if (item.geneticas) {
    return {
      nombre:   item.geneticas.nombre,
      sub:      labelTipo(item.geneticas.tipo),
      cantidad: formatGramos(item.cantidad_gramos ?? 0),
    };
  }
  return {
    nombre:   item.productos?.nombre ?? 'Producto',
    sub:      labelCategoriaProducto(item.productos?.categoria ?? 'otro'),
    cantidad: `${item.cantidad_unidades ?? 0} u.`,
  };
}

const filtrosEstado: { label: string; value: EstadoPedido | 'todos' }[] = [
  { label: 'Todos',     value: 'todos'     },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Aprobado',  value: 'aprobado'  },
  { label: 'Entregado', value: 'entregado' },
  { label: 'Cancelado', value: 'cancelado' },
];

// Presets de período para la vista "Todos"
type Periodo = 'todo' | 'hoy' | '7' | '30' | 'rango';

export function AdminPedidosClient({ pedidos: pedidosIniciales }: { pedidos: PedidoAdmin[] }) {
  const [pedidos, setPedidos]     = useState(pedidosIniciales);
  const [expandido, setExpandido] = useState<string | null>(null);
  // Arranca mostrando lo accionable: pendientes (o todos si no hay ninguno)
  const [filtro, setFiltro]       = useState<EstadoPedido | 'todos'>(
    () => pedidosIniciales.some(p => p.estado === 'pendiente') ? 'pendiente' : 'todos'
  );
  const [busqueda, setBusqueda]   = useState('');
  const [periodo, setPeriodo]     = useState<Periodo>('todo');
  const [desde, setDesde]         = useState('');
  const [hasta, setHasta]         = useState('');
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    // Límite inferior del período (solo aplica en la vista "Todos")
    let minFecha: Date | null = null;
    let maxFecha: Date | null = null;
    if (filtro === 'todos') {
      const hoy = new Date();
      if (periodo === 'hoy') {
        minFecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      } else if (periodo === '7' || periodo === '30') {
        minFecha = new Date(hoy);
        minFecha.setDate(hoy.getDate() - parseInt(periodo));
      } else if (periodo === 'rango') {
        if (desde) minFecha = new Date(`${desde}T00:00:00`);
        if (hasta) maxFecha = new Date(`${hasta}T23:59:59.999`);
      }
    }

    return pedidos.filter(p => {
      if (filtro !== 'todos' && p.estado !== filtro) return false;
      if (minFecha && new Date(p.created_at) < minFecha) return false;
      if (maxFecha && new Date(p.created_at) > maxFecha) return false;
      if (!q) return true;
      return (p.profiles?.nombre ?? '').toLowerCase().includes(q)
        || (p.profiles?.dni ?? '').includes(q);
    });
  }, [pedidos, filtro, busqueda, periodo, desde, hasta]);

  const handleCambiarEstado = (pedidoId: string, nuevoEstado: EstadoDestino) => {
    setLoadingId(pedidoId);
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoPedido(pedidoId, nuevoEstado);
      setLoadingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
    });
  };

  const handleVerComprobante = (pedidoId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await verComprobante(pedidoId);
      if (!res.ok) { setError(res.error); return; }
      // Signed URL de 5 minutos: se abre en pestaña nueva
      window.open(res.data.url, '_blank', 'noopener');
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">

      <PageHeader
        icon={<ShoppingBag className="w-5 h-5" />}
        title="Pedidos"
        subtitle={`${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} en total`}
      />

      {/* Toolbar: búsqueda + filtros */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por socio o DNI..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit overflow-x-auto">
          {filtrosEstado.map(f => {
            const count = f.value === 'todos'
              ? pedidos.length
              : pedidos.filter(p => p.estado === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  filtro === f.value
                    ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Filtro de período (solo en la vista "Todos") */}
      {filtro === 'todos' && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
            {([['todo', 'Todo'], ['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['rango', 'Rango']] as const).map(([valor, label]) => (
              <button
                key={valor}
                onClick={() => setPeriodo(valor)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  periodo === valor
                    ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {periodo === 'rango' && (
            <div className="flex items-center gap-2">
              <input type="date" value={desde} max={hasta || undefined}
                onChange={e => setDesde(e.target.value)}
                className="input-club py-1.5 text-xs" aria-label="Desde" />
              <span className="text-muted-foreground text-xs">a</span>
              <input type="date" value={hasta} min={desde || undefined}
                onChange={e => setHasta(e.target.value)}
                className="input-club py-1.5 text-xs" aria-label="Hasta" />
            </div>
          )}
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      {filtrados.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-16 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {pedidos.length === 0 ? 'Todavía no hay pedidos.' : 'No hay pedidos con este filtro.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map(pedido => {
            const abierto     = expandido === pedido.id;
            const totalGramos = pedido.pedido_items.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);
            const siguientes  = transiciones[pedido.estado];
            const inicial     = (pedido.profiles?.nombre ?? 'S').charAt(0).toUpperCase();

            return (
              <motion.div
                key={pedido.id}
                variants={fadeUp}
                className={cn(
                  'glass-card overflow-hidden border transition-colors',
                  abierto ? 'border-club-dorado/30' : 'border-transparent hover:border-club-dorado/20'
                )}
              >
                {/* Fila principal */}
                <button
                  onClick={() => setExpandido(abierto ? null : pedido.id)}
                  className="w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-club-dorado/10 border border-club-dorado/25 flex items-center justify-center shrink-0">
                    <span className="text-club-dorado text-sm font-bold">{inicial}</span>
                  </div>

                  {/* Socio + fecha */}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">
                      {pedido.profiles?.nombre ?? 'Socio'}
                      {pedido.profiles?.dni && (
                        <span className="text-muted-foreground font-normal text-xs ml-2">DNI {pedido.profiles.dni}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs flex items-center gap-1.5 mt-0.5">
                      <span className="text-club-dorado/80 font-semibold">{formatNumeroPedido(pedido.numero)}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <Clock className="w-3 h-3" />
                      {formatFecha(pedido.created_at)}
                      <span className="text-muted-foreground/40">·</span>
                      {pedido.pedido_items.length} ítem{pedido.pedido_items.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Comprobante cargado (indicador) */}
                  {pedido.comprobante_path && (
                    <span title="Comprobante de pago cargado" className="hidden sm:inline-flex p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shrink-0">
                      <Receipt className="w-3.5 h-3.5" />
                    </span>
                  )}

                  {/* Gramos de flores (si hay) */}
                  {totalGramos > 0 && (
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-club-dorado/10 border border-club-dorado/20 text-club-dorado text-xs font-bold shrink-0">
                      {formatGramos(totalGramos)}
                    </span>
                  )}

                  {/* Estado */}
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold shrink-0', badgePedido(pedido.estado))}>
                    {labelEstado[pedido.estado]}
                  </span>

                  <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
                    abierto && 'rotate-180'
                  )} />
                </button>

                {/* Detalle expandible */}
                <AnimatePresence initial={false}>
                  {abierto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-club-verde-claro/20">
                        {/* Items */}
                        <div className="divide-y divide-club-verde-claro/10">
                          {pedido.pedido_items.map(item => {
                            const d = itemDisplay(item);
                            return (
                              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                                <div>
                                  <p className="text-foreground text-sm font-medium">{d.nombre}</p>
                                  <p className="text-muted-foreground text-xs">{d.sub}</p>
                                </div>
                                <span className="text-club-dorado font-bold text-sm">{d.cantidad}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Notas + acciones */}
                        <div className="px-5 py-4 bg-club-dorado/5 space-y-4">
                          {totalGramos > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Total de flores</span>
                              <span className="text-club-dorado font-bold text-sm">{formatGramos(totalGramos)}</span>
                            </div>
                          )}

                          {pedido.entrega_franja && (
                            <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5 text-club-dorado" />
                              <span className="text-foreground/70 font-medium">Entrega: </span>
                              {pedido.entrega_franja}
                            </p>
                          )}

                          {pedido.notas && (
                            <p className="text-muted-foreground text-xs">
                              <span className="text-foreground/70 font-medium">Nota del socio: </span>
                              {pedido.notas}
                            </p>
                          )}

                          {/* Comprobante de pago */}
                          <div className="flex items-center justify-between gap-3">
                            {pedido.comprobante_path ? (
                              <>
                                <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                                  <Receipt className="w-3.5 h-3.5" />
                                  Comprobante cargado
                                  {pedido.comprobante_subido_at && ` el ${formatFecha(pedido.comprobante_subido_at)}`}
                                </span>
                                <button
                                  onClick={() => handleVerComprobante(pedido.id)}
                                  disabled={pending}
                                  className="shrink-0 px-3 py-1.5 rounded-xl border border-club-dorado/30 text-club-dorado text-xs font-medium hover:bg-club-dorado/10 transition-all flex items-center gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Ver comprobante
                                </button>
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <Receipt className="w-3.5 h-3.5" />
                                Sin comprobante de pago
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2 flex-wrap items-center">
                            {/* Vista imprimible (PDF vía diálogo del navegador) */}
                            <a
                              href={`/imprimir/pedido/${pedido.id}`}
                              target="_blank"
                              rel="noopener"
                              className="px-4 py-2 rounded-xl text-sm font-semibold border border-club-verde-claro/40 text-muted-foreground hover:text-foreground hover:border-club-dorado/40 transition-all flex items-center gap-1.5"
                            >
                              <Printer className="w-4 h-4" /> Imprimir
                            </a>
                          </div>

                          {siguientes.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {siguientes.map(estado => (
                                <button
                                  key={estado}
                                  onClick={() => handleCambiarEstado(pedido.id, estado)}
                                  disabled={pending && loadingId === pedido.id}
                                  className={cn(
                                    'px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
                                    estado === 'aprobado'  && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
                                    estado === 'entregado' && 'bg-club-dorado/15 text-club-dorado border-club-dorado/30 hover:bg-club-dorado/25',
                                    estado === 'cancelado' && 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
                                    pending && loadingId === pedido.id && 'opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  {pending && loadingId === pedido.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : `Marcar ${labelEstado[estado].toLowerCase()}`
                                  }
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
