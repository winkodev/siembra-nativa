'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, Package, ShoppingBag, AlertTriangle, Clock, ArrowRight, Shield, Truck, Receipt } from 'lucide-react';
import { formatGramos, formatFecha, formatNumeroPedido, diasHasta } from '@/lib/utils';
import type { MetricasAdmin } from '@/lib/types/database';

// Resumen de pedido para las listas de trabajo del dashboard
export interface PedidoResumen {
  id: string;
  numero: number | null;
  created_at: string;
  comprobante_path: string | null;
  profiles: { nombre: string } | null;
  pedido_items: { cantidad_gramos: number | null; cantidad_unidades: number | null }[];
}

// Etiqueta compacta del contenido de un pedido: "30 g" / "2 u." / "30 g + 2 u."
function resumenItems(p: PedidoResumen): string {
  const gramos   = p.pedido_items.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);
  const unidades = p.pedido_items.reduce((s, i) => s + (i.cantidad_unidades ?? 0), 0);
  const partes = [];
  if (gramos > 0)   partes.push(formatGramos(gramos));
  if (unidades > 0) partes.push(`${unidades} u.`);
  return partes.join(' + ') || 'Sin items';
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

interface MetricCardProps {
  label:    string;
  valor:    string | number;
  icon:     React.ReactNode;
  href?:    string;
  alerta?:  boolean;
}

function MetricCard({ label, valor, icon, href, alerta }: MetricCardProps) {
  const inner = (
    <div className={`glass-card p-5 border-dorado-hover group ${alerta ? 'border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          alerta ? 'bg-amber-500/15 text-amber-400' : 'bg-club-dorado/15 text-club-dorado'
        }`}>
          {icon}
        </div>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-club-dorado transition-colors" />}
      </div>
      <p className="font-avigea text-3xl text-foreground">{valor}</p>
      <p className="text-muted-foreground text-sm mt-1">{label}</p>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

interface Props {
  metricas:  MetricasAdmin;
  pendientes: Array<{ id: string; nombre: string; reprocann_estado: string; reprocann_numero: string | null; created_at: string }>;
  porVencer:  Array<{ id: string; nombre: string; reprocann_numero: string | null; reprocann_vencimiento: string | null }>;
  porAprobar:  PedidoResumen[];
  porEntregar: PedidoResumen[];
}

// Lista de pedidos accionables (por aprobar / por entregar)
function ListaPedidos({ titulo, icono, pedidos, vacio }: {
  titulo: string;
  icono: React.ReactNode;
  pedidos: PedidoResumen[];
  vacio: string;
}) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
          {icono}
          {titulo}
        </h2>
        <Link href="/admin/pedidos" className="text-club-dorado text-sm hover:text-club-dorado-claro transition-colors flex items-center gap-1">
          Ver todos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">{vacio}</p>
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => (
            <Link
              key={p.id}
              href="/admin/pedidos"
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-club-verde-claro/15 hover:bg-club-verde-claro/25 border border-transparent hover:border-club-dorado/20 transition-all duration-200 group"
            >
              <div>
                <p className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                  {p.profiles?.nombre ?? 'Socio'}
                  {p.comprobante_path && (
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" aria-label="Comprobante cargado" />
                  )}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  <span className="text-club-dorado/80 font-semibold">{formatNumeroPedido(p.numero)}</span>
                  {' · '}{formatFecha(p.created_at)} · {resumenItems(p)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-club-dorado transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function AdminDashboardClient({ metricas, pendientes, porVencer, porAprobar, porEntregar }: Props) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

      {/* Título */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-club-dorado/15 border border-club-dorado/25 flex items-center justify-center text-club-dorado shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-avigea text-2xl sm:text-3xl text-foreground leading-tight">Dashboard</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Resumen general del club</p>
          </div>
        </div>
        <div className="divider-dorado mt-3" />
      </motion.div>

      {/* Métricas */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Socios activos"
          valor={metricas.socios_activos}
          icon={<Users className="w-5 h-5" />}
          href="/admin/socios"
        />
        <MetricCard
          label="Stock total"
          valor={formatGramos(metricas.stock_total_gramos)}
          icon={<Package className="w-5 h-5" />}
          href="/admin/inventario"
        />
        <MetricCard
          label="Pedidos pendientes"
          valor={metricas.pedidos_pendientes}
          icon={<ShoppingBag className="w-5 h-5" />}
          href="/admin/pedidos"
          alerta={metricas.pedidos_pendientes > 0}
        />
        <MetricCard
          label="REPROCANN por vencer"
          valor={metricas.reprocann_por_vencer}
          icon={<AlertTriangle className="w-5 h-5" />}
          href="/admin/socios"
          alerta={metricas.reprocann_por_vencer > 0}
        />
      </motion.div>

      {/* Segunda fila de métricas */}
      {metricas.reprocann_vencidos > 0 && (
        <motion.div variants={fadeUp}
          className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-bold">{metricas.reprocann_vencidos}</span> socio{metricas.reprocann_vencidos !== 1 ? 's tienen' : ' tiene'} REPROCANN vencido.{' '}
            <Link href="/admin/socios" className="text-club-dorado underline underline-offset-2">Ver socios →</Link>
          </p>
        </motion.div>
      )}

      {/* Pedidos accionables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ListaPedidos
          titulo="Pedidos por aprobar"
          icono={<ShoppingBag className="w-5 h-5 text-amber-400" />}
          pedidos={porAprobar}
          vacio="No hay pedidos esperando aprobación."
        />
        <ListaPedidos
          titulo="Pedidos por entregar"
          icono={<Truck className="w-5 h-5 text-emerald-400" />}
          pedidos={porEntregar}
          vacio="No hay pedidos aprobados sin entregar."
        />
      </div>

      {/* REPROCANN por vencer (próximos 30 días) */}
      {porVencer.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Por vencer (próximos 90 días)
            </h2>
            <Link href="/admin/socios" className="text-club-dorado text-sm hover:text-club-dorado-claro transition-colors flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2">
            {porVencer.map((socio) => {
              const dias = socio.reprocann_vencimiento ? diasHasta(socio.reprocann_vencimiento) : null;
              return (
                <Link
                  key={socio.id}
                  href={`/admin/socios?socio=${socio.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 group"
                >
                  <div>
                    <p className="text-foreground text-sm font-semibold">{socio.nombre}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {socio.reprocann_numero ?? 'Sin número'}
                      {socio.reprocann_vencimiento && <> · Vence {formatFecha(socio.reprocann_vencimiento)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {dias !== null ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Por vencer'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-club-dorado transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Documentación pendiente de revisión */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-club-dorado" />
            Documentación pendiente de revisión
          </h2>
          <Link href="/admin/socios" className="text-club-dorado text-sm hover:text-club-dorado-claro transition-colors flex items-center gap-1">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {pendientes.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">
            No hay documentación pendiente de revisión.
          </p>
        ) : (
          <div className="space-y-2">
            {pendientes.map((socio) => (
              <Link
                key={socio.id}
                href={`/admin/socios?socio=${socio.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-club-verde-claro/15 hover:bg-club-verde-claro/25 border border-transparent hover:border-club-dorado/20 transition-all duration-200 group"
              >
                <div>
                  <p className="text-foreground text-sm font-semibold">{socio.nombre}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {socio.reprocann_numero ?? 'Sin número'} · Cargado {formatFecha(socio.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-reprocann-pendiente px-2.5 py-1 rounded-full text-xs font-medium">
                    Pendiente
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-club-dorado transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

    </motion.div>
  );
}
