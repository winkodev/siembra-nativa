'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Package, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2, Upload, Search } from 'lucide-react';
import { cn, labelCategoriaProducto } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { crearProducto, actualizarProducto, eliminarProducto, toggleProductoActivo } from '@/app/actions/productos';
import type { Producto, CategoriaProducto } from '@/lib/types/database';

const categorias: CategoriaProducto[] = ['aceite', 'merchandising', 'otro'];

const categoriaBadge: Record<CategoriaProducto, string> = {
  aceite:        'bg-amber-900/80 text-amber-200 border-amber-400/40',
  merchandising: 'bg-blue-900/80 text-blue-200 border-blue-400/40',
  otro:          'bg-gray-800/80 text-gray-300 border-gray-500/40',
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

interface FormData {
  nombre: string;
  descripcion: string;
  categoria: CategoriaProducto;
  precio: string;
  stock: string;
  imagen: File | null;
}

const formInicial: FormData = {
  nombre: '', descripcion: '', categoria: 'otro', precio: '', stock: '0', imagen: null,
};

export function AdminProductosClient({ productos: inicial }: { productos: Producto[] }) {
  const [productos, setProductos]   = useState(inicial);
  const [modalAbierto, setModal]    = useState(false);
  const [editando, setEditando]     = useState<Producto | null>(null);
  const [form, setForm]             = useState<FormData>(formInicial);
  const [preview, setPreview]       = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [busqueda, setBusqueda]     = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaProducto | 'todas'>('todas');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(p => {
      if (filtroCategoria !== 'todas' && p.categoria !== filtroCategoria) return false;
      return !q || p.nombre.toLowerCase().includes(q);
    });
  }, [productos, busqueda, filtroCategoria]);

  const abrirCrear = () => {
    setEditando(null);
    setForm(formInicial);
    setPreview(null);
    setError(null);
    setModal(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', categoria: p.categoria, precio: p.precio?.toString() ?? '', stock: p.stock.toString(), imagen: null });
    setPreview(p.imagen_url);
    setError(null);
    setModal(true);
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, imagen: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleGuardar = () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('nombre', form.nombre.trim());
      fd.append('descripcion', form.descripcion.trim());
      fd.append('categoria', form.categoria);
      fd.append('precio', form.precio);
      fd.append('stock', form.stock);
      if (form.imagen) fd.append('imagen', form.imagen);

      if (editando) {
        fd.append('id', editando.id);
        const res = await actualizarProducto(fd);
        if (!res.ok) { setError(res.error); return; }
        setProductos(prev => prev.map(p => p.id === editando.id ? res.data : p));
      } else {
        const res = await crearProducto(fd);
        if (!res.ok) { setError(res.error); return; }
        setProductos(prev => [res.data, ...prev]);
      }
      setModal(false);
    });
  };

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      const res = await eliminarProducto(id);
      if (!res.ok) { setError(res.error); return; }
      setProductos(prev => prev.filter(p => p.id !== id));
      setConfirmEliminar(null);
    });
  };

  const handleToggle = (id: string, activo: boolean) => {
    startTransition(async () => {
      const res = await toggleProductoActivo(id, !activo);
      if (!res.ok) return;
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: !activo } : p));
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

      <PageHeader
        icon={<Package className="w-5 h-5" />}
        title="Productos"
        subtitle={`${productos.length} producto${productos.length !== 1 ? 's' : ''} en la tienda`}
        action={
          <button onClick={abrirCrear} className="btn-primary text-sm px-5 py-2.5">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        }
      />

      {/* Toolbar: búsqueda + filtro de categoría */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit overflow-x-auto">
          <button
            onClick={() => setFiltroCategoria('todas')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              filtroCategoria === 'todas'
                ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Todas
          </button>
          {categorias.map(c => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                filtroCategoria === c
                  ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {labelCategoriaProducto(c)}
            </button>
          ))}
        </div>
      </motion.div>

      {error && !modalAbierto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      {/* Grid de productos */}
      {filtrados.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {productos.length === 0 ? 'No hay productos cargados.' : 'Sin resultados para este filtro.'}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtrados.map(p => (
            <motion.div key={p.id} variants={fadeUp}
              className={cn('glass-card overflow-hidden', !p.activo && 'opacity-60 grayscale')}
            >
              {/* Imagen */}
              <div className="relative h-40 bg-club-verde-claro/20">
                {p.imagen_url ? (
                  <Image src={p.imagen_url} alt={p.nombre} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                    <Package className="w-16 h-16" />
                  </div>
                )}
                <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium border', categoriaBadge[p.categoria])}>
                  {labelCategoriaProducto(p.categoria)}
                </span>
                {!p.activo && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs border border-white/20 text-white/70 backdrop-blur-sm">
                    Inactivo
                  </span>
                )}
              </div>

              <div className="p-4 space-y-2">
                <h3 className="font-avigea text-lg text-foreground leading-tight">{p.nombre}</h3>
                {p.descripcion && <p className="text-muted-foreground text-xs line-clamp-2">{p.descripcion}</p>}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  {p.precio != null
                    ? <span className="text-club-dorado font-bold text-sm">${p.precio.toFixed(2)}</span>
                    : <span>Sin precio</span>
                  }
                  <span>Stock: {p.stock}</span>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => abrirEditar(p)} className="flex-1 px-3 py-2 rounded-xl border border-club-verde-claro/30 text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/10 text-xs transition-all flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => handleToggle(p.id, p.activo)} disabled={pending} className="px-3 py-2 rounded-xl border border-club-verde-claro/30 text-muted-foreground hover:text-club-dorado hover:border-club-dorado/30 text-xs transition-all">
                    {p.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setConfirmEliminar(p.id)} className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 text-xs transition-all">
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
        {modalAbierto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-lg overflow-y-auto max-h-[90vh]">

              <div className="flex items-center justify-between p-5 border-b border-club-verde-claro/20">
                <h2 className="font-avigea text-xl text-foreground">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
                <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Imagen */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-2 block">Imagen</label>
                  <label className="relative flex flex-col items-center justify-center h-36 border-2 border-dashed border-club-verde-claro/30 rounded-xl cursor-pointer hover:border-club-dorado/40 transition-all overflow-hidden">
                    {preview ? (
                      <Image src={preview} alt="preview" fill className="object-cover" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground/40 mb-2" />
                        <span className="text-muted-foreground text-xs">Subir imagen</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleImagenChange} />
                  </label>
                </div>

                {/* Nombre */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="input-club w-full" placeholder="Ej: Aceite CBD 10%" />
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaProducto }))} className="input-club w-full">
                    {categorias.map(c => <option key={c} value={c}>{labelCategoriaProducto(c)}</option>)}
                  </select>
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} className="input-club w-full resize-none" placeholder="Descripción del producto..." />
                </div>

                {/* Precio y stock */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Precio ($)</label>
                    <input type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} className="input-club w-full" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Stock (unidades)</label>
                    <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="input-club w-full" />
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModal(false)} className="btn-secondary flex-1 py-3">Cancelar</button>
                  <button onClick={handleGuardar} disabled={pending} className="btn-primary flex-1 py-3">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? 'Guardar cambios' : 'Crear producto'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm eliminar */}
      <AnimatePresence>
        {confirmEliminar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm p-6 text-center space-y-4">
              <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-foreground font-semibold">¿Eliminar producto?</p>
              <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmEliminar(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={() => handleEliminar(confirmEliminar)} disabled={pending}
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
