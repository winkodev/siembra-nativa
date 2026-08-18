'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag, ArrowLeft, Loader2, CheckCircle2, AlertTriangle,
  CalendarClock, MapPin, Check, Receipt,
} from 'lucide-react';
import { useCarrito } from '@/lib/context/CarritoContext';
import { crearPedido, subirComprobante } from '@/app/actions/pedidos';
import { createClient } from '@/lib/supabase/client';
import { cn, formatGramos, formatFranja, formatPrecio, labelTipo, labelCategoriaProducto } from '@/lib/utils';
import type { FranjaHoraria, CarritoItem } from '@/lib/types/database';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

// Monto de un item del carrito (0 si no tiene precio cargado)
function montoItem(i: CarritoItem): number {
  return i.tipo_item === 'genetica'
    ? (i.precio_gramo ?? 0) * i.cantidad_gramos
    : (i.precio ?? 0) * i.cantidad_unidades;
}

export default function NuevoPedidoPage() {
  const { items, vaciar, descuento20, descuento40 } = useCarrito();
  const router = useRouter();
  const [notas, setNotas]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [exito, setExito]     = useState(false);

  // Datos del club: franjas activas, config de envío/comprobante y dirección del socio
  const [franjas, setFranjas]   = useState<FranjaHoraria[]>([]);
  const [franjaId, setFranjaId] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);
  const [direccionOk, setDireccionOk] = useState(false);
  const [comprobanteObligatorio, setComprobanteObligatorio] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [gratisDesde, setGratisDesde] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    supabase.from('franjas_horarias').select('*').order('created_at')
      .then(({ data }) => setFranjas((data as FranjaHoraria[]) ?? []));

    supabase.from('configuracion_app').select('clave, valor')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const r of data ?? []) map[r.clave] = r.valor;
        setComprobanteObligatorio(map['comprobante_obligatorio'] === 'true');
        setCostoEnvio(parseFloat(map['costo_envio'] ?? '0') || 0);
        setGratisDesde(parseFloat(map['envio_gratis_desde'] ?? '0') || 0);
      });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('direccion, localidad, provincia, codigo_postal')
        .eq('id', user.id)
        .single();
      const dir = [p?.direccion, p?.localidad, p?.provincia, p?.codigo_postal].filter(Boolean).join(', ');
      setDireccion(dir || null);
    });
  }, []);

  const totalGramos    = items.reduce((acc, i) => acc + (i.tipo_item === 'genetica' ? i.cantidad_gramos : 0), 0);
  const totalProductos = items.reduce((acc, i) => acc + (i.tipo_item === 'producto' ? i.cantidad_unidades : 0), 0);

  // Resumen de montos (mismo cálculo que hace la base al confirmar)
  const subtotalFlores = items.reduce((acc, i) => acc + (i.tipo_item === 'genetica' ? montoItem(i) : 0), 0);
  const subtotal   = items.reduce((acc, i) => acc + montoItem(i), 0);
  const descPct    = totalGramos >= 40 ? descuento40 : totalGramos >= 20 ? descuento20 : 0;
  const descMonto  = Math.round(subtotalFlores * descPct) / 100;
  const envioGratis = gratisDesde > 0 && totalGramos >= gratisDesde;
  const montoEnvio = costoEnvio > 0 && !envioGratis ? costoEnvio : 0;
  const totalMonto = subtotal - descMonto + montoEnvio;

  const handleConfirmar = async () => {
    if (franjas.length > 0 && !franjaId) { setError('Elegí un horario de entrega'); return; }
    if (!direccion) { setError('Cargá tu dirección en Mi Perfil antes de confirmar el pedido'); return; }
    if (!direccionOk) { setError('Confirmá que la dirección de entrega es correcta'); return; }
    if (comprobanteObligatorio && !comprobante) { setError('Adjuntá el comprobante de pago para confirmar'); return; }

    setLoading(true);
    setError(null);
    const res = await crearPedido(items, notas, franjaId);

    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }

    // Subir el comprobante asociado al pedido recién creado
    if (comprobante) {
      const fd = new FormData();
      fd.append('pedido_id', res.data.pedido_id);
      fd.append('comprobante', comprobante);
      await subirComprobante(fd);
      // Si fallara, el socio puede reintentarlo desde Mis Pedidos
    }

    setLoading(false);
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
        <Link href="/socio/tienda" className="btn-primary text-sm px-6 py-2.5">Ver catálogo</Link>
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

      {/* Items + montos */}
      <motion.div variants={fadeUp} className="glass-card divide-y divide-club-verde-claro/20">
        {items.map(item => {
          const monto = montoItem(item);
          return (
            <div key={`${item.tipo_item}:${item.id}`} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-foreground font-semibold">{item.nombre}</p>
                <p className="text-muted-foreground text-xs">
                  {item.tipo_item === 'genetica'
                    ? labelTipo(item.tipo)
                    : labelCategoriaProducto(item.categoria)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-club-dorado font-bold">
                  {item.tipo_item === 'genetica'
                    ? formatGramos(item.cantidad_gramos)
                    : `${item.cantidad_unidades} u.`}
                </span>
                {monto > 0 && (
                  <p className="text-muted-foreground text-xs mt-0.5">{formatPrecio(monto)}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Resumen */}
        <div className="px-5 py-4 bg-club-dorado/5 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cantidad</span>
            <span className="text-foreground font-semibold">
              {[
                totalGramos > 0 ? formatGramos(totalGramos) : null,
                totalProductos > 0 ? `${totalProductos} u.` : null,
              ].filter(Boolean).join(' + ') || '—'}
            </span>
          </div>
          {totalMonto > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground font-semibold">{formatPrecio(subtotal)}</span>
              </div>
              {descMonto > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400 font-semibold">
                    Descuento {descPct}% por {totalGramos >= 40 ? '40g' : '20g'} o más
                  </span>
                  <span className="text-emerald-400 font-semibold">−{formatPrecio(descMonto)}</span>
                </div>
              )}
              {costoEnvio > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  {envioGratis
                    ? <span className="text-emerald-400 font-semibold">Gratis</span>
                    : <span className="text-foreground font-semibold">{formatPrecio(costoEnvio)}</span>}
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-club-verde-claro/20">
                <span className="text-foreground font-semibold">Total</span>
                <span className="text-club-dorado font-bold text-lg">{formatPrecio(totalMonto)}</span>
              </div>
            </>
          )}
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

      {/* Dirección de entrega */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <label className="text-sm text-foreground/80 font-medium flex items-center gap-2">
          <MapPin className="w-4 h-4 text-club-dorado" />
          Dirección de entrega *
        </label>
        {direccion ? (
          <>
            <p className="text-foreground text-sm">{direccion}</p>
            <button
              onClick={() => setDireccionOk(v => !v)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                direccionOk
                  ? 'border-club-dorado/50 bg-club-dorado/10'
                  : 'border-white/10 bg-club-verde-claro/10 hover:border-club-dorado/40'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                direccionOk ? 'bg-club-dorado border-club-dorado' : 'border-white/30'
              )}>
                {direccionOk && <Check className="w-3.5 h-3.5 text-club-verde" />}
              </span>
              <span className="text-sm text-foreground">
                Confirmo la dirección de entrega
              </span>
            </button>
            <p className="text-muted-foreground text-xs">
              ¿No es correcta? <Link href="/socio/perfil" className="text-club-dorado underline underline-offset-2">Actualizala en tu perfil</Link> antes de confirmar.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>
              No tenés una dirección cargada.{' '}
              <Link href="/socio/perfil" className="text-club-dorado underline underline-offset-2">
                Cargala en tu perfil
              </Link>{' '}
              para poder confirmar el pedido.
            </p>
          </div>
        )}
      </motion.div>

      {/* Comprobante de pago (si el club lo exige) */}
      {comprobanteObligatorio && (
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
          <label className="text-sm text-foreground/80 font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4 text-club-dorado" />
            Comprobante de pago *
          </label>
          <label className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm',
            comprobante
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-club-verde-claro/40 text-muted-foreground hover:border-club-dorado/40'
          )}>
            {comprobante
              ? <><CheckCircle2 className="w-4 h-4" /> {comprobante.name}</>
              : <><Receipt className="w-4 h-4" /> Adjuntar comprobante (imagen o PDF)</>}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={e => setComprobante(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-muted-foreground text-xs">
            El club revisa el comprobante antes de aprobar el pedido.
          </p>
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
      {!comprobanteObligatorio && (
        <motion.div variants={fadeUp} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-club-dorado/8 border border-club-dorado/20 text-sm text-foreground/70">
          <AlertTriangle className="w-4 h-4 text-club-dorado flex-shrink-0 mt-0.5" />
          El pago se coordina directamente con el club. Este sistema solo registra tu pedido.
        </motion.div>
      )}

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
