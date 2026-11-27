'use client';

import { useState, useMemo, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
  Newspaper, Plus, Pencil, Trash2, X, Loader2, Upload, Search,
  Eye, PenLine, Globe, GlobeLock, ImageIcon, Pin, PinOff, Users,
  Bold, Italic, Heading2, List, ListOrdered, Link2, Quote,
} from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsletterTabs } from './NewsletterTabs';
import { NovedadTarjeta, NovedadModal, EncuadreImagen } from '@/components/newsletter/Novedad';
import { crearNewsletter, actualizarNewsletter, eliminarNewsletter, togglePublicado, fijarNewsletter } from '@/app/actions/newsletter';
import type { Newsletter } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

type FiltroEstado = 'todos' | 'publicados' | 'borradores';

interface FormState {
  titulo: string;
  contenido: string;
  imagen: File | null;
  pos_x: number;   // encuadre de la imagen en la tarjeta
  pos_y: number;
  vigente_hasta: string;  // '' = sin vencimiento
}

// Un socio que abrió la novedad
export interface Lectura { nombre: string; visto_at: string }

const hoyAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const formInicial: FormState = { titulo: '', contenido: '', imagen: null, pos_x: 50, pos_y: 50, vigente_hasta: '' };

export function AdminNewsletterClient({ articulos: inicial, lecturas, sociosActivos }: { articulos: Newsletter[]; lecturas: Record<string, Lectura[]>; sociosActivos: number }) {
  const [articulos, setArticulos]   = useState(inicial);
  const [modalAbierto, setModal]    = useState(false);
  const [editando, setEditando]     = useState<Newsletter | null>(null);
  const [form, setForm]             = useState<FormState>(formInicial);
  const [preview, setPreview]       = useState<string | null>(null);
  const [tab, setTab]               = useState<'editar' | 'vista'>('editar');
  const [verCompleta, setVerCompleta] = useState(false);
  const [lectores, setLectores]     = useState<Newsletter | null>(null);
  const texto = useRef<HTMLTextAreaElement>(null);

  // Barra de formato: envuelve la selección (o inserta al principio de cada línea)
  const formato = (antes: string, despues = '', porLinea = false) => {
    const t = texto.current;
    if (!t) return;
    const { selectionStart: i, selectionEnd: j, value } = t;
    const sel = value.slice(i, j);
    const nuevo = porLinea
      ? (sel || 'texto').split('\n').map((l, n) => `${antes.replace('1.', `${n + 1}.`)}${l}`).join('\n')
      : `${antes}${sel || 'texto'}${despues}`;
    const contenido = value.slice(0, i) + nuevo + value.slice(j);
    setForm(f => ({ ...f, contenido }));
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(i, i + nuevo.length); });
  };
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
    setVerCompleta(false);
    setError(null);
    setModal(true);
  };

  const abrirEditar = (a: Newsletter) => {
    setEditando(a);
    setForm({ titulo: a.titulo, contenido: a.contenido, imagen: null, pos_x: Number(a.imagen_pos_x ?? 50), pos_y: Number(a.imagen_pos_y ?? 50), vigente_hasta: a.vigente_hasta ?? '' });
    setPreview(a.imagen_url);
    setTab('editar');
    setVerCompleta(false);
    setError(null);
    setModal(true);
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, imagen: file, pos_x: 50, pos_y: 50 }));
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
      fd.append('imagen_pos_x', String(form.pos_x));
      fd.append('imagen_pos_y', String(form.pos_y));
      fd.append('vigente_hasta', form.vigente_hasta);

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

  const handleFijar = (a: Newsletter) => {
    startTransition(async () => {
      const res = await fijarNewsletter(a.id, !a.fijada);
      if (!res.ok) { setError(res.error); return; }
      setArticulos(prev => prev.map(x => x.id === a.id ? res.data : x));
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
      <NewsletterTabs />

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
                  <Image src={a.imagen_url} alt={a.titulo} fill className="object-cover" style={{ objectPosition: `${a.imagen_pos_x ?? 50}% ${a.imagen_pos_y ?? 50}%` }} />
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

                <p className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
                  <span>{a.publicado && a.fecha_publicacion
                    ? `Publicado el ${formatFecha(a.fecha_publicacion, "dd 'de' MMMM 'de' yyyy")}`
                    : `Creado el ${formatFecha(a.created_at, "dd 'de' MMMM 'de' yyyy")}`}</span>
                  {a.fijada && <span className="flex items-center gap-1 text-club-dorado"><Pin className="w-3.5 h-3.5" /> Destacada</span>}
                  {a.vigente_hasta && (
                    <span className={cn(a.vigente_hasta < hoyAR() && 'text-red-400')}>
                      {a.vigente_hasta < hoyAR() ? 'Vencida' : 'Se muestra hasta'} el {formatFecha(a.vigente_hasta, 'dd/MM/yyyy')}
                    </span>
                  )}
                  {a.publicado && (() => {
                    const n = lecturas[a.id]?.length ?? 0;
                    return (
                      <button onClick={() => setLectores(a)} disabled={n === 0} className="flex items-center gap-1 hover:text-foreground disabled:hover:text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" /> {n} socio{n === 1 ? '' : 's'} la {n === 1 ? 'leyó' : 'leyeron'}
                        {sociosActivos > 0 && ` · ${Math.round((n / sociosActivos) * 100)}% de los activos`}
                      </button>
                    );
                  })()}
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
                  <button onClick={() => handleFijar(a)} disabled={pending} title={a.fijada ? 'Quitar de destacadas' : 'Destacar: queda primera en el inicio del socio'}
                    className={cn('px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-1.5',
                      a.fijada ? 'border-club-dorado/40 text-club-dorado' : 'border-club-verde-claro/30 text-muted-foreground hover:text-foreground')}>
                    {a.fijada ? <><PinOff className="w-3.5 h-3.5" /> Quitar destacado</> : <><Pin className="w-3.5 h-3.5" /> Destacar</>}
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
                {/* Escribir o ver como el socio */}
                <div className="flex gap-1 p-1 glass-card rounded-lg w-fit">
                  {([['editar', 'Escribir', <PenLine key="e" className="w-3.5 h-3.5" />], ['vista', 'Vista previa', <Eye key="v" className="w-3.5 h-3.5" />]] as const).map(([k, label, icono]) => (
                    <button key={k} onClick={() => setTab(k)}
                      className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                        tab === k ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
                      {icono} {label}
                    </button>
                  ))}
                </div>

                {tab === 'vista' ? (
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-xs">Así aparece en el inicio del socio. Tocá la tarjeta para verla completa, como cuando la abre.</p>
                    <div className="max-w-sm">
                      <NovedadTarjeta novedad={{ titulo: form.titulo, contenido: form.contenido, imagen_url: preview, imagen_pos_x: form.pos_x, imagen_pos_y: form.pos_y, fecha_publicacion: editando?.fecha_publicacion ?? new Date().toISOString(), fijada: editando?.fijada }} onClick={() => setVerCompleta(true)} />
                    </div>
                    {verCompleta && <NovedadModal novedad={{ titulo: form.titulo, contenido: form.contenido, imagen_url: preview, imagen_pos_x: form.pos_x, imagen_pos_y: form.pos_y, fecha_publicacion: editando?.fecha_publicacion ?? new Date().toISOString(), fijada: editando?.fijada }} onClose={() => setVerCompleta(false)} />}
                  </div>
                ) : (
                <>
                {/* Portada: se arrastra para elegir qué parte se ve en la tarjeta */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-foreground/70 font-medium">Imagen de portada (opcional)</label>
                    {preview && (
                      <label className="text-club-dorado text-xs font-semibold cursor-pointer flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Cambiar imagen
                        <input type="file" accept="image/*" className="sr-only" onChange={handleImagenChange} />
                      </label>
                    )}
                  </div>
                  {preview ? (
                    <div className="max-w-sm">
                      <EncuadreImagen src={preview} x={form.pos_x} y={form.pos_y} onChange={(x, y) => setForm(f => ({ ...f, pos_x: x, pos_y: y }))} />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-club-verde-claro/30 rounded-xl cursor-pointer hover:border-club-dorado/40 transition-all">
                      <Upload className="w-8 h-8 text-muted-foreground/40 mb-2" />
                      <span className="text-muted-foreground text-xs">Subir imagen</span>
                      <input type="file" accept="image/*" className="sr-only" onChange={handleImagenChange} />
                    </label>
                  )}
                </div>

                {/* Título */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Título *</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    className="input-club w-full" placeholder="Ej: Novedades de agosto" />
                </div>

                {/* Vencimiento */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Se muestra hasta</label>
                  <div className="flex items-center gap-3">
                    <input type="date" value={form.vigente_hasta} min={hoyAR()} onChange={e => setForm(f => ({ ...f, vigente_hasta: e.target.value }))} className="input-club" />
                    {form.vigente_hasta
                      ? <button type="button" onClick={() => setForm(f => ({ ...f, vigente_hasta: '' }))} className="text-xs text-muted-foreground hover:text-foreground">Sin vencimiento</button>
                      : <span className="text-xs text-muted-foreground">Vacío: se muestra siempre</span>}
                  </div>
                </div>

                {/* Contenido */}
                <div>
                  <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Contenido *</label>
                  {/* Barra de formato: seleccioná texto y tocá un botón */}
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {([
                      ['Negrita', <Bold key="b" className="w-3.5 h-3.5" />, () => formato('**', '**')],
                      ['Cursiva', <Italic key="i" className="w-3.5 h-3.5" />, () => formato('*', '*')],
                      ['Subtítulo', <Heading2 key="h" className="w-3.5 h-3.5" />, () => formato('## ', '', true)],
                      ['Lista', <List key="l" className="w-3.5 h-3.5" />, () => formato('- ', '', true)],
                      ['Lista numerada', <ListOrdered key="n" className="w-3.5 h-3.5" />, () => formato('1. ', '', true)],
                      ['Cita', <Quote key="q" className="w-3.5 h-3.5" />, () => formato('> ', '', true)],
                      ['Link', <Link2 key="k" className="w-3.5 h-3.5" />, () => formato('[', '](https://)')],
                    ] as const).map(([titulo, icono, accion]) => (
                      <button key={titulo} type="button" title={titulo} onClick={accion}
                        className="p-2 rounded-lg border border-club-verde-claro/30 text-muted-foreground hover:text-foreground hover:bg-club-verde-claro/10 transition-colors">
                        {icono}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={texto}
                    value={form.contenido}
                    onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                    rows={12}
                    className="input-club w-full resize-y font-mono text-sm leading-relaxed"
                    placeholder={'Escribí la novedad. Seleccioná texto y usá los botones de arriba para darle formato.'}
                  />
                </div>
                </>
                )}

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

      {/* Quiénes la leyeron */}
      {lectores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setLectores(null)}>
          <div onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-avigea text-xl text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-club-dorado" /> La leyeron</h2>
                <p className="text-muted-foreground text-xs mt-0.5">{lectores.titulo}</p>
              </div>
              <button onClick={() => setLectores(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-foreground">{lecturas[lectores.id]?.length ?? 0} de {sociosActivos} socios activos</p>
            <div className="divide-y divide-club-verde-claro/10 overflow-y-auto">
              {(lecturas[lectores.id] ?? []).map((l, i) => (
                <p key={i} className="py-2 flex justify-between gap-3 text-sm">
                  <span className="text-foreground">{l.nombre}</span>
                  <span className="text-muted-foreground text-xs">{formatFecha(l.visto_at, "dd/MM 'a las' HH:mm")}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

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
