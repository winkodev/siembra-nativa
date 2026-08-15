'use client';

import { useState, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Loader2, Package,
  CheckCircle2, CalendarDays, MapPin, Tag, Search,
} from 'lucide-react';
import { agregarStock, editarStock, eliminarStock } from '@/app/actions/inventario';
import { cn, formatFecha, formatGramos, labelTipo } from '@/lib/utils';
import type { Genetica, Stock, Ubicacion, ActionResponse } from '@/lib/types/database';

type StockConGenetica = Stock & { geneticas: { nombre: string; tipo: string } };
const initial: ActionResponse = { ok: true, data: undefined };

const tipoBadge: Record<string, string> = {
  indica:  'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  sativa:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  hibrida: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary px-5 py-2.5 text-sm">
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : label}
    </button>
  );
}

/* Calcula el próximo nombre de lote: LOTE-AAAA-NNN incremental dentro del año */
function siguienteLote(stock: { lote: string | null }[]): string {
  const anio = new Date().getFullYear();
  const patron = new RegExp(`^LOTE-${anio}-(\\d+)$`, 'i');
  const max = stock.reduce((acc, s) => {
    const m = s.lote?.match(patron);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `LOTE-${anio}-${String(max + 1).padStart(3, '0')}`;
}

// ---- Modal para agregar / editar un registro de stock ----
interface StockModalProps {
  stockItem?:  StockConGenetica;
  geneticas:   Genetica[];
  ubicaciones: Ubicacion[];
  loteSugerido: string;
  onClose:     () => void;
}

function StockModal({ stockItem, geneticas, ubicaciones, loteSugerido, onClose }: StockModalProps) {
  const isEdit = !!stockItem;
  const action = isEdit
    ? editarStock.bind(null, stockItem.id)
    : agregarStock;

  const [state, formAction] = useFormState(action, initial);

  if (state?.ok && state !== initial) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-club">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-avigea text-xl text-foreground">
            {isEdit ? 'Editar ingreso' : 'Nuevo ingreso de stock'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {state && !state.ok && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">

          {/* Genética */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/80 font-medium">Genética *</label>
            <select
              name="genetica_id"
              required
              defaultValue={stockItem?.genetica_id ?? ''}
              className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer"
            >
              <option value="" disabled>Seleccioná una genética</option>
              {geneticas.filter(g => g.activa).map(g => (
                <option key={g.id} value={g.id}>{g.nombre} — {labelTipo(g.tipo)}</option>
              ))}
            </select>
          </div>

          {/* Cantidad ingresada (lo restante se recalcula preservando lo consumido) */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/80 font-medium">Cantidad ingresada (gramos) *</label>
            <input
              name="cantidad_gramos"
              type="number"
              step="0.1"
              min="0.1"
              required
              defaultValue={stockItem?.cantidad_inicial ?? stockItem?.cantidad_gramos ?? ''}
              className="input-club w-full"
              placeholder="500"
            />
            {isEdit && stockItem && stockItem.cantidad_inicial > stockItem.cantidad_gramos && (
              <p className="text-xs text-muted-foreground">
                Este lote ya dispensó {stockItem.cantidad_inicial - stockItem.cantidad_gramos}g; quedan {stockItem.cantidad_gramos}g.
              </p>
            )}
          </div>

          {/* Lote + Ubicación */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-club-dorado" /> Lote
              </label>
              <input
                name="lote"
                type="text"
                defaultValue={stockItem?.lote ?? loteSugerido}
                className="input-club w-full"
                placeholder={loteSugerido}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-club-dorado" /> Ubicación
              </label>
              <select
                name="ubicacion"
                defaultValue={stockItem?.ubicacion ?? ''}
                className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer"
              >
                <option value="">Sin ubicación</option>
                {ubicaciones.map(u => (
                  <option key={u.id} value={u.nombre}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha de ingreso */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/80 font-medium flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-club-dorado" /> Fecha de ingreso *
            </label>
            <input
              name="fecha_ingreso"
              type="date"
              required
              defaultValue={stockItem?.fecha_ingreso ?? new Date().toISOString().split('T')[0]}
              className="input-club w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">Cancelar</button>
            <SubmitButton label={isEdit ? 'Guardar cambios' : 'Registrar ingreso'} />
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---- Componente principal del tab ----
interface Props {
  stock:       StockConGenetica[];
  geneticas:   Genetica[];
  ubicaciones: Ubicacion[];
  reservas:    Record<string, number>;  // gramos en pedidos pendientes, por genética
}

export function StockTab({ stock, geneticas, ubicaciones, reservas }: Props) {
  const [modal, setModal]           = useState<'nuevo' | StockConGenetica | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [filtroGenetica, setFiltroGenetica] = useState<string>('todas');
  const [busqueda, setBusqueda]     = useState('');

  const loteSugerido = useMemo(() => siguienteLote(stock), [stock]);

  // Filtrado por genética + búsqueda en lote/ubicación
  const stockFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return stock.filter(s => {
      if (filtroGenetica !== 'todas' && s.genetica_id !== filtroGenetica) return false;
      if (!q) return true;
      return (s.lote ?? '').toLowerCase().includes(q)
        || (s.ubicacion ?? '').toLowerCase().includes(q)
        || s.geneticas.nombre.toLowerCase().includes(q);
    });
  }, [stock, filtroGenetica, busqueda]);

  // Totales por genética: físico (tabla stock), reservado (pedidos pendientes)
  // y disponible (lo que realmente puede venderse)
  const totalesPorGenetica = geneticas
    .filter(g => g.activa)
    .map(g => {
      const fisico = stock
        .filter(s => s.genetica_id === g.id)
        .reduce((acc, s) => acc + s.cantidad_gramos, 0);
      const reservado = reservas[g.id] ?? 0;
      return { ...g, fisico, reservado, disponible: Math.max(fisico - reservado, 0) };
    })
    .filter(g => g.fisico > 0 || g.reservado > 0)
    .sort((a, b) => b.disponible - a.disponible);

  const handleDelete = async (id: string) => {
    const res = await eliminarStock(id);
    if (!res.ok) setError(res.error ?? 'Error');
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Resumen de stock por genética */}
      {totalesPorGenetica.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-avigea text-base text-foreground mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-club-dorado" /> Stock disponible para la venta
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {totalesPorGenetica.map(g => (
              <div key={g.id} className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-club-verde-claro/15 border border-club-verde-claro/25">
                <span className={cn('text-xs px-2 py-0.5 rounded-full w-fit', tipoBadge[g.tipo])}>
                  {labelTipo(g.tipo)}
                </span>
                <p className="text-foreground text-sm font-semibold truncate">{g.nombre}</p>
                <p className="text-club-dorado font-bold text-lg leading-none">{formatGramos(g.disponible)}</p>
                {g.reservado > 0 && (
                  <p className="text-xs mt-0.5 leading-tight">
                    <span className="text-amber-400 font-medium">{formatGramos(g.reservado)} reservado</span>
                    <span className="text-muted-foreground"> · físico {formatGramos(g.fisico)}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar: búsqueda + filtro por genética + acción */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por lote, genética o ubicación..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <select
          value={filtroGenetica}
          onChange={e => setFiltroGenetica(e.target.value)}
          className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2.5 text-sm sm:w-52"
        >
          <option value="todas">Todas las genéticas</option>
          {geneticas.filter(g => g.activa).map(g => (
            <option key={g.id} value={g.id}>{g.nombre}</option>
          ))}
        </select>
        <button onClick={() => setModal('nuevo')} className="btn-primary text-sm px-4 py-2.5 shrink-0">
          <Plus className="w-4 h-4" /> Registrar ingreso
        </button>
      </div>

      <p className="text-muted-foreground text-xs">
        {stockFiltrado.length} de {stock.length} registro{stock.length !== 1 ? 's' : ''}
      </p>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabla log */}
      {stockFiltrado.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {stock.length === 0 ? 'No hay ingresos de stock registrados.' : 'Sin resultados para este filtro.'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-club-verde-claro/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Genética</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ingresado</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Restante</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Lote</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Ubicación</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha ingreso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {stockFiltrado.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-club-verde-claro/15 hover:bg-club-verde-claro/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-foreground font-medium">{s.geneticas.nombre}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', tipoBadge[s.geneticas.tipo])}>
                          {labelTipo(s.geneticas.tipo)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground font-semibold">{formatGramos(s.cantidad_inicial)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-bold',
                        s.cantidad_gramos === 0
                          ? 'text-muted-foreground/50'
                          : s.cantidad_gramos < s.cantidad_inicial
                          ? 'text-amber-400'
                          : 'text-club-dorado'
                      )}>
                        {formatGramos(s.cantidad_gramos)}
                      </span>
                      {s.cantidad_gramos === 0 && (
                        <span className="text-muted-foreground/50 text-xs ml-1.5">agotado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {s.lote ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {s.ubicacion ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatFecha(s.fecha_ingreso)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal(s)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-club-dorado hover:bg-club-dorado/10 transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(s.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <StockModal
            stockItem={modal === 'nuevo' ? undefined : modal}
            geneticas={geneticas}
            ubicaciones={ubicaciones}
            loteSugerido={loteSugerido}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-club">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 max-w-sm w-full text-center"
            >
              <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="font-avigea text-lg text-foreground mb-2">¿Eliminar registro?</h3>
              <p className="text-muted-foreground text-sm mb-5">Se eliminará este ingreso del historial de stock.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm px-5 py-2">Cancelar</button>
                <button onClick={() => handleDelete(confirmDelete)} className="px-5 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors">
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
