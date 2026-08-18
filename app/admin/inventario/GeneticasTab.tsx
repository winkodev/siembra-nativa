'use client';

import { useState, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  X, Loader2, CheckCircle2, Upload, ImageIcon, Leaf, Search,
} from 'lucide-react';
import { crearGenetica, editarGenetica, eliminarGenetica, toggleGeneticaActiva } from '@/app/actions/inventario';
import { cn, labelTipo, formatGramos, formatPrecio, labelCalidad, labelCultivo } from '@/lib/utils';
import type { Genetica, ActionResponse } from '@/lib/types/database';

const initial: ActionResponse = { ok: true, data: undefined };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const tipoBadge: Record<string, string> = {
  indica:  'bg-purple-900/80 text-purple-200 border border-purple-400/40 backdrop-blur-sm',
  sativa:  'bg-amber-900/80 text-amber-200 border border-amber-400/40 backdrop-blur-sm',
  hibrida: 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/40 backdrop-blur-sm',
};

const calidadBadge: Record<string, string> = {
  regular: 'bg-gray-800/80 text-gray-300 border border-gray-500/40',
  premium: 'bg-club-dorado/15 text-club-dorado border border-club-dorado/40',
};

const cultivoBadge: Record<string, string> = {
  indoor:  'bg-sky-900/80 text-sky-200 border border-sky-400/40',
  outdoor: 'bg-lime-900/80 text-lime-200 border border-lime-400/40',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary px-5 py-2.5 text-sm">
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : label}
    </button>
  );
}

interface ModalProps {
  genetica?: Genetica;
  onClose:   () => void;
}

function GeneticaModal({ genetica, onClose }: ModalProps) {
  const isEdit = !!genetica;
  const action = isEdit
    ? editarGenetica.bind(null, genetica.id)
    : crearGenetica;

  const [state, formAction] = useFormState(action, initial);
  const [preview, setPreview] = useState<string | null>(genetica?.imagen_url ?? null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  };

  // Cerrar al guardar exitosamente
  if (state?.ok && state !== initial) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-club">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-avigea text-xl text-foreground">
            {isEdit ? 'Editar genética' : 'Nueva genética'}
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

          {/* Imagen */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/80 font-medium">Imagen</label>
            <label htmlFor="imagen-input" className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-club-verde-claro/50 hover:border-club-dorado/40 cursor-pointer transition-colors bg-club-verde-claro/10 hover:bg-club-dorado/5 group">
              {preview ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden">
                  <Image src={preview} alt="Preview" fill className="object-cover" />
                </div>
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 text-muted-foreground group-hover:text-club-dorado/60 transition-colors" />
                  <span className="text-sm text-muted-foreground">JPG, PNG o WEBP · Máx 5MB</span>
                </>
              )}
              {preview && <span className="text-xs text-muted-foreground">Clic para cambiar</span>}
            </label>
            <input id="imagen-input" name="imagen" type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={handleImage} />
          </div>

          {/* Nombre + Banco + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Nombre *</label>
              <input name="nombre" type="text" required defaultValue={genetica?.nombre ?? ''} className="input-club w-full" placeholder="OG Kush" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Banco (semillera)</label>
              <input name="banco" type="text" defaultValue={genetica?.banco ?? ''} className="input-club w-full" placeholder="R-Kiem Seeds" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/80 font-medium">Tipo *</label>
            <select name="tipo" required defaultValue={genetica?.tipo ?? ''} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              <option value="" disabled>Seleccioná</option>
              <option value="indica">Índica</option>
              <option value="sativa">Sativa</option>
              <option value="hibrida">Híbrida</option>
            </select>
          </div>

          {/* THC + CBD + Precio */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">THC %</label>
              <input name="thc" type="number" step="0.1" min="0" max="100" defaultValue={genetica?.thc ?? ''} className="input-club w-full" placeholder="22.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">CBD %</label>
              <input name="cbd" type="number" step="0.1" min="0" max="100" defaultValue={genetica?.cbd ?? ''} className="input-club w-full" placeholder="0.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Precio $/g</label>
              <input name="precio_gramo" type="number" step="0.01" min="0" defaultValue={genetica?.precio_gramo ?? ''} className="input-club w-full" placeholder="1500" />
            </div>
          </div>

          {/* Calidad + Cultivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Calidad</label>
              <select name="calidad" defaultValue={genetica?.calidad ?? ''} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
                <option value="">Sin especificar</option>
                <option value="regular">Regular</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Cultivo</label>
              <select name="cultivo" defaultValue={genetica?.cultivo ?? ''} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
                <option value="">Sin especificar</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/80 font-medium">Descripción</label>
            <textarea name="descripcion" rows={3} defaultValue={genetica?.descripcion ?? ''}
              className="input-club w-full resize-none" placeholder="Efectos, aromas, notas de cultivo..." />
          </div>

          {/* Novedad */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-club-verde-claro/30 bg-club-verde-claro/10 cursor-pointer hover:border-club-dorado/40 transition-colors">
            <input
              type="checkbox"
              name="novedad"
              defaultChecked={genetica?.novedad ?? false}
              className="w-4 h-4 accent-club-dorado"
            />
            <span className="text-sm text-foreground">
              Marcar como <span className="text-club-dorado font-semibold">novedad</span>
              <span className="block text-xs text-muted-foreground">Muestra la cinta NOVEDAD en el catálogo</span>
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">Cancelar</button>
            <SubmitButton label={isEdit ? 'Guardar cambios' : 'Crear genética'} />
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const filtrosTipo = [
  { label: 'Todas',    value: 'todas'   },
  { label: 'Índica',   value: 'indica'  },
  { label: 'Sativa',   value: 'sativa'  },
  { label: 'Híbrida',  value: 'hibrida' },
];

export function GeneticasTab({ geneticas }: { geneticas: Genetica[] }) {
  const [modal, setModal]         = useState<'crear' | Genetica | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [busqueda, setBusqueda]   = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todas');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return geneticas.filter(g => {
      if (filtroTipo !== 'todas' && g.tipo !== filtroTipo) return false;
      return !q || g.nombre.toLowerCase().includes(q);
    });
  }, [geneticas, busqueda, filtroTipo]);

  const handleToggle = async (g: Genetica) => {
    const res = await toggleGeneticaActiva(g.id, !g.activa);
    if (!res.ok) setError(res.error);
  };

  const handleDelete = async (id: string) => {
    const res = await eliminarGenetica(id);
    if (!res.ok) setError(res.error);
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Toolbar: búsqueda + filtro tipo + acción */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar genética..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
          {filtrosTipo.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroTipo(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                filtroTipo === f.value
                  ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setModal('crear')} className="btn-primary text-sm px-4 py-2.5 shrink-0">
          <Plus className="w-4 h-4" /> Nueva genética
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Grid de cards */}
      {filtradas.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Leaf className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {geneticas.length === 0 ? 'No hay genéticas cargadas todavía.' : 'Sin resultados para este filtro.'}
          </p>
          {geneticas.length === 0 && (
            <button onClick={() => setModal('crear')} className="btn-primary text-sm mt-4 px-5 py-2.5">
              <Plus className="w-4 h-4" /> Crear la primera
            </button>
          )}
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtradas.map(g => (
            <motion.div
              key={g.id}
              variants={fadeUp}
              className={cn('glass-card overflow-hidden group border border-transparent hover:border-club-dorado/20 transition-all duration-200', !g.activa && 'grayscale opacity-60')}
            >
              {/* Imagen */}
              <div className="relative h-44 bg-club-verde-claro/20">
                {g.imagen_url ? (
                  <Image src={g.imagen_url} alt={g.nombre} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <Leaf className="w-16 h-16" />
                  </div>
                )}
                {/* Badge tipo */}
                <span className={cn('absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium', tipoBadge[g.tipo])}>
                  {labelTipo(g.tipo)}
                </span>
                {/* Cinta novedad */}
                {g.novedad && g.activa && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-club-dorado text-club-verde">
                    Novedad
                  </span>
                )}
                {/* Badge inactiva */}
                {!g.activa && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium border border-white/20 text-white/70 backdrop-blur-sm">
                    Inactiva
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-avigea text-lg text-foreground mb-1">
                  {g.nombre}
                  {g.banco && <span className="text-muted-foreground text-xs font-sans font-normal"> by {g.banco}</span>}
                </h3>
                <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                  {g.thc != null && <span>THC {g.thc}%</span>}
                  {g.cbd != null && <span>CBD {g.cbd}%</span>}
                  {g.precio_gramo != null && (
                    <span className="text-club-dorado font-bold">{formatPrecio(g.precio_gramo)}/g</span>
                  )}
                  {g.calidad && (
                    <span className={cn('px-2 py-0.5 rounded-full font-medium', calidadBadge[g.calidad])}>
                      {labelCalidad(g.calidad)}
                    </span>
                  )}
                  {g.cultivo && (
                    <span className={cn('px-2 py-0.5 rounded-full font-medium', cultivoBadge[g.cultivo])}>
                      {labelCultivo(g.cultivo)}
                    </span>
                  )}
                </div>
                {g.descripcion && (
                  <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{g.descripcion}</p>
                )}

                {/* Acciones */}
                <div className="flex items-center gap-2 pt-2 border-t border-club-verde-claro/20">
                  <button onClick={() => setModal(g)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-club-dorado hover:bg-club-dorado/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => handleToggle(g)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/20 transition-all">
                    {g.activa ? <ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {g.activa ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => setConfirmDelete(g.id)} className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal crear/editar */}
      <AnimatePresence>
        {modal && (
          <GeneticaModal
            genetica={modal === 'crear' ? undefined : modal}
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
              <h3 className="font-avigea text-lg text-foreground mb-2">¿Eliminar genética?</h3>
              <p className="text-muted-foreground text-sm mb-5">Esta acción no se puede deshacer. Si tiene stock, usá "Desactivar" en cambio.</p>
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
