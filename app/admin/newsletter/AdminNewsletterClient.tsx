'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
  Newspaper, Plus, Pencil, Trash2, X, Loader2, Upload, Search,
  Eye, PenLine, Globe, GlobeLock,
} from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { crearNewsletter, actualizarNewsletter, eliminarNewsletter, togglePublicado } from '@/app/actions/newsletter';
import type { Newsletter } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

type FiltroEstado = 'todos' | 'publicados' | 'borradores';

interface FormState {
  titulo: string;
  contenido: string;
  imagen: File | null;
}

const formInicial: FormState = { titulo: '', contenido: '', imagen: null };

export function AdminNewsletterClient({ articulos: inicial }: { articulos: Newsletter[] }) {
  const [articulos, setArticulos]   = useState(inicial);
  const [modalAbierto, setModal]    = useState(false);
  const [editando, setEditando]     = useState<Newsletter | null>(null);
  const [form, setForm]             = useState<FormState>(formInicial);
  const [preview, setPreview]       = useState<string | null>(null);
  const [tab, setTab]               = useState<'editar' | 'vista'>('editar');
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [busqueda, setBusqueda]     = useState('');
  const [filtro, setFiltro]         = useState<FiltroEstado>('todos');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return articulos.filter(a => {
      if (filtro === 'publicados' && !a.publicado) return false;
      if (filtro === 'borradores' && a.publicado) return false;
      return !q || a.titulo.toLowerCase().includes(q);
    });
  }, [articulos, busqueda, filtro]);

  const abrirCrear = () => {
    setEditando(null);
    setForm(formInicial);
    setPreview(null);
    setTab('editar');
    setError(null);
    setModal(true);
  };

  const abrirEditar = (a: Newsletter) => {
    setEditando(a);
    setForm({ titulo: a.titulo, contenido: a.contenido, imagen: null });
    setPreview(a.imagen_url);
    setTab('editar');
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
    if (!form.titulo.trim())    { setError('El título es obligatorio'); return; }
    if (!form.contenido.trim()) { setError('El contenido es obligatorio'); return; }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('titulo', form.titulo.trim());
      fd.append('contenido', form.contenido.trim());
      if (form.imagen) fd.append('imagen', form.imagen);

      if (editando) {
        fd.append('id', editando.id);
        const res = await actualizarNewsletter(fd);
        if (!res.ok) { setError(res.error); return; }
        setArticulos(prev => prev.map(a => a.id === editando.id ? res.data : a));
      } else {
        const res = await crearNewsletter(fd);
        if (!res.ok) { setError(res.error); return; }
        setArticulos(prev => [res.data, ...prev]);
      }
      setModal(false);
    });
  };

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      const res = await eliminarNewsletter(id);
      if (!res.ok) { setError(res.error); return; }
      setArticulos(prev => prev.filter(a => a.id !== id));
      setConfirmEliminar(null);
    });
  };

  const handleTogglePublicado = (a: Newsletter) => {
    startTransition(async () => {
      const res = await togglePublicado(a.id, !a.publicado);
      if (!res.ok) { setError(res.error); return; }
      setArticulos(prev => prev.map(x => x.id === a.id ? res.data : x));
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

      <PageHeader
        icon={<Newspaper className="w-5 h-5" />}
        title="Newsletter"
        subtitle={`${articulos.length} artículo${articulos.length !== 1 ? 's' : ''} · ${articulos.filter(a => a.publicado).length} publicado${articulos.filter(a => a.publicado).length !== 1 ? 's' : ''}`}
        action={
          <button onClick={abrirCrear} className="btn-primary text-sm px-5 py-2.5">
            <Plus className="w-4 h-4" /> Nuevo artículo
          </button>
        }
      />

      {/* Toolbar: búsqueda + filtro de estado */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar artículo..."
            className="input-club w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
          {([['todos', 'Todos'], ['publicados', 'Publicados'], ['borradores', 'Borradores']] as const).map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setFiltro(valor)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                filtro === valor
                  ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
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

      {/* Lista de artículos */}
      {filtrados.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-16 text-center">
          <Newspaper className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {articulos.length === 0 ? 'Todavía no hay artículos. Creá el primero.' : 'Sin resultados para este filtro.'}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-4">
          {filtrados.map(a => (
            <motion.div key={a.id} variants={fadeUp}
              className={cn('glass-card overflow-hidden flex flex-col sm:flex-row', !a.publicado && 'opacity-75')}
            >
              {/* Portada */}
              <div className="relative sm:w-48 h-36 sm:h-auto shrink-0 bg-club-verde-claro/20">
                {a.imagen_url ? (
                  <Image src={a.imagen_url} alt={a.titulo} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                    <Newspaper className="w-12 h-12" />
                  </div>
                )}
              </div>

              <div className="flex-1 p-5 flex flex-col gap-2 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-avigea text-xl text-foreground leading-tight">{a.titulo}</h3>
                  <span className={cn(
                    'shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    a.publicado
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  )}>
                    {a.publicado ? 'Publicado' : 'Borrador'}
                  </span>
                </div>

                <p className="text-muted-foreground text-xs">
                  {a.publicado && a.fecha_publicacion
                    ? `Publicado el ${formatFecha(a.fecha_publicacion, "dd 'de' MMMM 'de' yyyy")}`
                    : `Creado el ${formatFecha(a.created_at, "dd 'de' MMMM 'de' yyyy")}`}
                </p>

                <div className="prose prose-sm prose-invert max-w-none text-muted-foreground line-clamp-2 prose-headings:text-foreground prose-strong:text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{a.contenido}</ReactMarkdown>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-2 mt-auto flex-wrap">
                  <button onClick={() => abrirEditar(a)}
                    className="px-3 py-2 rounded-xl border border-club-verde-claro/30 text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/10 text-xs transition-all flex items-center gap-1.5">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => handleTogglePublicado(a)} disabled={pending}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-1.5',
                      a.publicado
                        ? 'border-amber-500/30 text-amber-400/80 hover:text-amber-400 hover:border-amber-500/50'
                        : 'border-emerald-500/30 text-emerald-400/80 hover:text-emerald-400 hover:border-emerald-500/50'
                    )}>
                    {a.publicado
                      ? <><GlobeLock className="w-3.5 h-3.5" /> Despublicar</>
                      : <><Globe className="w-3.5 h-3.5" /> Publicar</>}
                  </button>
                  <button onClick={() => setConfirmEliminar(a.id)}
                    className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 text-xs transition-all">
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
              className="glass-card w-full max-w-2xl overflow-y-auto max-h-[90vh]">

              <div className="flex items-center justify-between p-5 border-b border-club-verde-claro/20">
                <h2 className="font-avigea text-xl text-foreground">{editando ? 'Editar artículo' : 'Nuevo artículo'}</h2>
                <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Portada */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-2 block">Imagen de portada (opcional)</label>
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

                {/* Título */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Título *</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    className="input-club w-full" placeholder="Ej: Novedades de agosto" />
                </div>

                {/* Contenido: tabs Editar / Vista previa */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-foreground/70 font-medium">Contenido (Markdown) *</label>
                    <div className="flex gap-1 p-0.5 glass-card rounded-lg">
                      <button onClick={() => setTab('editar')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1',
                          tab === 'editar' ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <PenLine className="w-3 h-3" /> Escribir
                      </button>
                      <button onClick={() => setTab('vista')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1',
                          tab === 'vista' ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <Eye className="w-3 h-3" /> Vista previa
                      </button>
                    </div>
                  </div>

                  {tab === 'editar' ? (
                    <textarea
                      value={form.contenido}
                      onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                      rows={12}
                      className="input-club w-full resize-y font-mono text-sm leading-relaxed"
                      placeholder={'## Título de sección\n\nEscribí el contenido en **Markdown**...'}
                    />
                  ) : (
                    <div className="min-h-[18rem] px-4 py-3 rounded-xl border border-club-verde-claro/30 bg-club-verde-claro/10">
                      {form.contenido.trim() ? (
                        <div className="prose prose-sm prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{form.contenido}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground/50 text-sm italic">Nada para previsualizar todavía.</p>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModal(false)} className="btn-secondary flex-1 py-3">Cancelar</button>
                  <button onClick={handleGuardar} disabled={pending} className="btn-primary flex-1 py-3">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? 'Guardar cambios' : 'Crear borrador'}
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
              <p className="text-foreground font-semibold">¿Eliminar artículo?</p>
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
