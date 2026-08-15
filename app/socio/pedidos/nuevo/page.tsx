'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { crearPedido } from '@/app/actions/pedidos';
import { createClient } from '@/lib/supabase/client';
import { cn, formatGramos, formatFranja, labelTipo, labelCategoriaProducto } from '@/lib/utils';
import type { FranjaHoraria } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function NuevoPedidoPage() {
  const { items, vaciar } = useCarrito();
  const router = useRouter();
  const [notas, setNotas]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [exito, setExito]     = useState(false);

  // Franjas de entrega activas (RLS solo expone las activas)
  const [franjas, setFranjas]   = useState<FranjaHoraria[]>([]);
  const [franjaId, setFranjaId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('franjas_horarias')
      .select('*')
      .order('created_at')
      .then(({ data }) => setFranjas((data as FranjaHoraria[]) ?? []));
  }, []);

  const totalGramos    = items.reduce((acc, i) => acc + (i.tipo_item === 'genetica' ? i.cantidad_gramos : 0), 0);
  const totalProductos = items.reduce((acc, i) => acc + (i.tipo_item === 'producto' ? i.cantidad_unidades : 0), 0);

  const handleConfirmar = async () => {
    if (franjas.length > 0 && !franjaId) {
      setError('Elegí un horario de entrega');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await crearPedido(items, notas, franjaId);
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    vaciar();
    setExito(true);
    setTimeout(() => router.push('/socio/pedidos'), 2500);
  };

  if (exito) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 text-center max-w-sm"
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="font-avigea text-2xl text-foreground mb-2">¡Pedido enviado!</h2>
          <p className="text-muted-foreground text-sm">El equipo del club lo va a revisar pronto. Redirigiendo...</p>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Tu pedido está vacío.</p>
        <Link href="/socio/tienda" className="btn-primary text-sm px-6 py-2.5">Ver tienda</Link>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-xl mx-auto space-y-5">

      <motion.div variants={fadeUp}>
        <Link href="/socio/tienda" className="inline-flex items-center gap-2 text-muted-foreground hover:text-club-dorado transition-colors text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Seguir eligiendo
        </Link>
        <h1 className="font-avigea text-3xl text-foreground">Confirmar pedido</h1>
        <div className="divider-dorado mt-2" />
      </motion.div>

      {/* Items */}
      <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/20">
        {items.map(item => (
          <div key={`${item.tipo_item}:${item.id}`} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-foreground font-semibold">{item.nombre}</p>
              <p className="text-muted-foreground text-xs">
                {item.tipo_item === 'genetica'
                  ? labelTipo(item.tipo)
                  : labelCategoriaProducto(item.categoria)}
              </p>
            </div>
            <span className="text-club-dorado font-bold">
              {item.tipo_item === 'genetica'
                ? formatGramos(item.cantidad_gramos)
                : `${item.cantidad_unidades} u.`}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-4 bg-club-dorado/5">
          <span className="text-foreground font-semibold">Total</span>
          <span className="text-club-dorado font-bold text-lg">
            {[
              totalGramos > 0 ? formatGramos(totalGramos) : null,
              totalProductos > 0 ? `${totalProductos} u.` : null,
            ].filter(Boolean).join(' + ') || '—'}
          </span>
        </div>
      </motion.div>

      {/* Horario de entrega */}
      {franjas.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
          <label className="text-sm text-foreground/80 font-medium flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-club-dorado" />
            Horario de entrega *
          </label>
          <div className="flex flex-wrap gap-2">
            {franjas.map(f => (
              <button
                key={f.id}
                onClick={() => setFranjaId(f.id)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  franjaId === f.id
                    ? 'bg-club-dorado text-club-verde border-club-dorado shadow-dorado-sm'
                    : 'bg-club-verde-claro/15 text-muted-foreground border-white/10 hover:border-club-dorado/40 hover:text-foreground'
                )}
              >
                {formatFranja(f)}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notas */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-2">
        <label className="text-sm text-foreground/80 font-medium">Notas para el club (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
          className="input-club w-full resize-none"
          placeholder="Consultas, aclaraciones..."
        />
      </motion.div>

      {/* Aviso pago externo */}
      <motion.div variants={fadeUp} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-club-dorado/8 border border-club-dorado/20 text-sm text-foreground/70">
        <AlertTriangle className="w-4 h-4 text-club-dorado flex-shrink-0 mt-0.5" />
        El pago se coordina directamente con el club. Este sistema solo registra tu pedido.
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      {/* Botón confirmar */}
      <motion.div variants={fadeUp}>
        <button
          onClick={handleConfirmar}
          disabled={loading}
          className="btn-primary w-full py-4 text-base"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando pedido...</>
            : <><ShoppingBag className="w-5 h-5" /> Confirmar pedido</>
          }
        </button>
      </motion.div>

    </motion.div>
  );
}
