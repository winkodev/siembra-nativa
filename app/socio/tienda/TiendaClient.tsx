'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Leaf, Package, Search, ShoppingBag, AlertTriangle, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { cn, labelTipo, labelCategoriaProducto, labelCalidad, labelCultivo, formatPrecio } from '@/lib/utils';
import type { StockPublico, Producto } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const tipoBadge: Record<string, string> = {
  indica:  'bg-purple-900/80 text-purple-200 border border-purple-400/40 backdrop-blur-sm',
  sativa:  'bg-amber-900/80 text-amber-200 border border-amber-400/40 backdrop-blur-sm',
  hibrida: 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/40 backdrop-blur-sm',
};

const categoriaBadge: Record<string, string> = {
  aceite:        'bg-amber-900/80 text-amber-200 border-amber-400/40',
  merchandising: 'bg-blue-900/80 text-blue-200 border-blue-400/40',
  otro:          'bg-gray-800/80 text-gray-300 border-gray-500/40',
};

const calidadBadge: Record<string, string> = {
  regular: 'bg-gray-800/80 text-gray-300 border border-gray-500/40',
  premium: 'bg-club-dorado/15 text-club-dorado border border-club-dorado/40',
};

const cultivoBadge: Record<string, string> = {
  indoor:  'bg-sky-900/80 text-sky-200 border border-sky-400/40',
  outdoor: 'bg-lime-900/80 text-lime-200 border border-lime-400/40',
};

// Filtro unificado: flores secas + aceites + otros productos
type Filtro = 'todos' | 'flores' | 'aceite' | 'otros';

// Entrada renderizable: una flor (genética) o un producto
type Entry = { kind: 'flor'; data: StockPublico } | { kind: 'producto'; data: Producto };

interface Props {
  flores:            StockPublico[];
  productos:         Producto[];
  puedeHacerPedidos: boolean;
}

export function TiendaClient({ flores, productos, puedeHacerPedidos }: Props) {
  const [filtro, setFiltro]     = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Lista combinada: flores primero, productos después
  const entradas: Entry[] = [
    ...flores.map(f => ({ kind: 'flor' as const, data: f })),
    ...productos.map(p => ({ kind: 'producto' as const, data: p })),
  ];

  const q = busqueda.trim().toLowerCase();
  const filtradas = entradas.filter(e => {
    // Filtro por tipo
    if (filtro === 'flores' && e.kind !== 'flor') return false;
    if (filtro === 'aceite' && !(e.kind === 'producto' && e.data.categoria === 'aceite')) return false;
    if (filtro === 'otros'  && !(e.kind === 'producto' && e.data.categoria !== 'aceite')) return false;
    // Filtro por búsqueda
    return e.data.nombre.toLowerCase().includes(q);
  });

  // Mostrar solo los filtros que tienen contenido
  const hayFlores  = flores.length > 0;
  const hayAceite  = productos.some(p => p.categoria === 'aceite');
  const hayOtros   = productos.some(p => p.categoria !== 'aceite');
  const filtros: { label: string; value: Filtro }[] = [
    { label: 'Todos', value: 'todos' },
    ...(hayFlores ? [{ label: 'Flores secas', value: 'flores' as const }] : []),
    ...(hayAceite ? [{ label: 'Aceites',      value: 'aceite' as const }] : []),
    ...(hayOtros  ? [{ label: 'Otros',        value: 'otros'  as const }] : []),
  ];

  return (
    <div className="space-y-6">

      <div>
        <h1 className="font-avigea text-3xl text-foreground flex items-center gap-3">
          <ShoppingBag className="w-7 h-7 text-club-dorado" />
          Tienda
        </h1>
        <div className="divider-dorado mt-2" />
      </div>

      {!puedeHacerPedidos && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-5 py-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            Tu documentación aún no fue aprobada. Podés explorar la tienda, pero para hacer pedidos necesitás aprobación del club.{' '}
            <Link href="/socio/perfil" className="text-club-dorado underline underline-offset-2">
              Subir documentación →
            </Link>
          </p>
        </motion.div>
      )}

      {/* Buscador + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar en la tienda..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input-club w-full pl-10"
          />
        </div>
        {filtros.length > 1 && (
          <div className="flex gap-1.5 p-1 glass-card rounded-xl overflow-x-auto">
            {filtros.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  filtro === f.value
                    ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid combinado */}
      {filtradas.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {entradas.length === 0
              ? 'Próximamente habrá productos disponibles.'
              : 'No hay nada con ese filtro.'}
          </p>
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filtradas.map(e =>
              e.kind === 'flor'
                ? <FlorCard key={`flor:${e.data.genetica_id}`} flor={e.data} puedeHacerPedidos={puedeHacerPedidos} />
                : <ProductoCard key={`prod:${e.data.id}`} producto={e.data} puedeHacerPedidos={puedeHacerPedidos} />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// Card de flor (genética) — se agrega directo desde la tienda,
// igual que los productos; el detalle queda en la imagen/nombre
// ============================================================
const GRAMOS_FLOR = [10, 20, 30, 40];

function FlorCard({ flor, puedeHacerPedidos }: { flor: StockPublico; puedeHacerPedidos: boolean }) {
  const { agregar, tieneItem } = useCarrito();
  const enCarrito = tieneItem({ tipo_item: 'genetica', id: flor.genetica_id });
  const sinStock  = flor.stock_total_gramos < Math.min(...GRAMOS_FLOR);

  const [cantidad, setCantidad] = useState(10);
  const [feedback, setFeedback] = useState(false);

  const handleAgregar = () => {
    agregar({
      tipo_item:        'genetica',
      id:               flor.genetica_id,
      nombre:           flor.nombre,
      tipo:             flor.tipo,
      cantidad_gramos:  cantidad,
      stock_disponible: flor.stock_total_gramos,
      precio_gramo:     flor.precio_gramo,
    });
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1400);
  };

  return (
    <motion.div
      variants={fadeUp}
      layout
      className={cn(
        'glass-card overflow-hidden group transition-all duration-300 hover:border-club-dorado/30 hover:-translate-y-1 hover:shadow-dorado-sm border border-transparent flex flex-col',
        sinStock && 'opacity-70'
      )}
    >
      <Link href={`/socio/catalogo/${flor.genetica_id}`} className="block relative h-48 bg-club-verde-claro/20 overflow-hidden">
        {flor.imagen_url ? (
          <Image src={flor.imagen_url} alt={flor.nombre} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
            <Leaf className="w-20 h-20" />
          </div>
        )}
        <span className={cn('absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium', tipoBadge[flor.tipo])}>
          {labelTipo(flor.tipo)}
        </span>
        {enCarrito && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm border bg-club-dorado/90 text-club-verde border-club-dorado/40 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> En pedido
          </span>
        )}
      </Link>

      <div className="p-4 space-y-2 flex flex-col flex-1">
        <Link href={`/socio/catalogo/${flor.genetica_id}`} className="block">
          <h3 className="font-avigea text-lg text-foreground leading-tight hover:text-club-dorado transition-colors">
            {flor.nombre}
          </h3>
        </Link>
        <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
          {flor.thc != null && <span>THC {flor.thc}%</span>}
          {flor.cbd != null && <span>CBD {flor.cbd}%</span>}
          {flor.precio_gramo != null && (
            <span className="text-club-dorado font-bold">{formatPrecio(flor.precio_gramo)}/g</span>
          )}
          {flor.calidad && (
            <span className={cn('px-2 py-0.5 rounded-full font-medium', calidadBadge[flor.calidad])}>
              {labelCalidad(flor.calidad)}
            </span>
          )}
          {flor.cultivo && (
            <span className={cn('px-2 py-0.5 rounded-full font-medium', cultivoBadge[flor.cultivo])}>
              {labelCultivo(flor.cultivo)}
            </span>
          )}
        </div>

        {/* Selector de gramos + agregar (igual que productos) */}
        <div className="mt-auto pt-2 space-y-2">
          {sinStock ? (
            <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-club-verde-claro/10 text-muted-foreground cursor-not-allowed border border-club-verde-claro/20">
              Sin stock
            </button>
          ) : !puedeHacerPedidos ? (
            <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-club-verde-claro/10 text-muted-foreground cursor-not-allowed border border-club-verde-claro/20">
              Documentación pendiente
            </button>
          ) : (
            <>
              <div className="flex gap-1.5">
                {GRAMOS_FLOR.map(g => (
                  <button
                    key={g}
                    onClick={() => setCantidad(g)}
                    disabled={g > flor.stock_total_gramos}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                      cantidad === g
                        ? 'bg-club-dorado text-club-verde border-club-dorado'
                        : 'bg-transparent text-muted-foreground border-club-verde-claro/40 hover:border-club-dorado/50 hover:text-foreground'
                    )}
                  >
                    {g}g
                  </button>
                ))}
              </div>

              <motion.button
                onClick={handleAgregar}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200',
                  feedback
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-club-dorado/15 text-club-dorado border border-club-dorado/30 hover:bg-club-dorado/25'
                )}
              >
                {feedback
                  ? <><CheckCircle2 className="w-4 h-4" /> Agregado</>
                  : <>
                      <Plus className="w-4 h-4" /> Agregar {cantidad}g
                      {flor.precio_gramo != null && (
                        <span className="font-bold">· {formatPrecio(cantidad * flor.precio_gramo)}</span>
                      )}
                    </>
                }
              </motion.button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Card de producto — selector de unidades + agregar al carrito
// ============================================================
function ProductoCard({ producto, puedeHacerPedidos }: { producto: Producto; puedeHacerPedidos: boolean }) {
  const { agregar, tieneItem } = useCarrito();
  const enCarrito = tieneItem({ tipo_item: 'producto', id: producto.id });
  const sinStock  = producto.stock === 0;

  const [cantidad, setCantidad] = useState(1);
  const [feedback, setFeedback] = useState(false);

  const handleAgregar = () => {
    agregar({
      tipo_item:         'producto',
      id:                producto.id,
      nombre:            producto.nombre,
      categoria:         producto.categoria,
      precio:            producto.precio,
      cantidad_unidades: cantidad,
      stock_disponible:  producto.stock,
    });
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1400);
  };

  return (
    <motion.div
      variants={fadeUp}
      layout
      className={cn(
        'glass-card overflow-hidden group transition-all duration-300 hover:border-club-dorado/30 hover:-translate-y-1 hover:shadow-dorado-sm border border-transparent flex flex-col',
        sinStock && 'opacity-70'
      )}
    >
      <Link href={`/socio/producto/${producto.id}`} className="block relative h-48 bg-club-verde-claro/20 overflow-hidden">
        {producto.imagen_url ? (
          <Image src={producto.imagen_url} alt={producto.nombre} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
            <Package className="w-20 h-20" />
          </div>
        )}
        <span className={cn('absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm', categoriaBadge[producto.categoria])}>
          {labelCategoriaProducto(producto.categoria)}
        </span>
        {sinStock && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-900/80 text-gray-400 border border-gray-500/40 backdrop-blur-sm">
            Sin stock
          </span>
        )}
        {!sinStock && enCarrito && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm border bg-club-dorado/90 text-club-verde border-club-dorado/40 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> En pedido
          </span>
        )}
      </Link>

      <div className="p-4 space-y-2 flex flex-col flex-1">
        <Link href={`/socio/producto/${producto.id}`} className="block">
          <h3 className="font-avigea text-lg text-foreground leading-tight hover:text-club-dorado transition-colors">{producto.nombre}</h3>
        </Link>
        {producto.descripcion && (
          <p className="text-muted-foreground text-xs line-clamp-2">{producto.descripcion}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          {producto.precio != null
            ? <span className="text-club-dorado font-bold">${producto.precio.toFixed(2)}</span>
            : <span className="text-muted-foreground text-sm">Consultar precio</span>
          }
          {!sinStock && <span className="text-muted-foreground text-xs">{producto.stock} disponibles</span>}
        </div>

        {/* Acción: selector de unidades + agregar */}
        <div className="mt-auto pt-2">
          {sinStock ? (
            <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-club-verde-claro/10 text-muted-foreground cursor-not-allowed border border-club-verde-claro/20">
              Sin stock
            </button>
          ) : !puedeHacerPedidos ? (
            <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-club-verde-claro/10 text-muted-foreground cursor-not-allowed border border-club-verde-claro/20">
              Documentación pendiente
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Stepper de unidades */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCantidad(c => Math.max(1, c - 1))}
                  disabled={cantidad <= 1}
                  className="p-1.5 rounded-lg border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-foreground">{cantidad}</span>
                <button
                  onClick={() => setCantidad(c => Math.min(producto.stock, c + 1))}
                  disabled={cantidad >= producto.stock}
                  className="p-1.5 rounded-lg border border-club-verde-claro/40 text-foreground hover:border-club-dorado/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botón agregar */}
              <motion.button
                onClick={handleAgregar}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200',
                  feedback
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-club-dorado/15 text-club-dorado border border-club-dorado/30 hover:bg-club-dorado/25'
                )}
              >
                {feedback
                  ? <><CheckCircle2 className="w-4 h-4" /> Agregado</>
                  : <><Plus className="w-4 h-4" /> Agregar</>
                }
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
