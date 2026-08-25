'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
  Leaf, ShoppingBag, AlertTriangle, ArrowRight, Newspaper,
  FileText, Shield, CheckCircle2, Clock, XCircle, UserRound, ChevronDown,
  Bell, Loader2,
} from 'lucide-react';
import type { Profile, Newsletter, Notificacion } from '@/lib/types/database';
import { formatFecha, diasHasta, cn, estadoEfectivoReprocann } from '@/lib/utils';
import { marcarNotificacionesLeidas } from '@/app/actions/notificaciones';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

interface Props {
  profile:        Profile;
  newsletter:     Newsletter | null;
  notificaciones: Notificacion[];
}

function perfilCompleto(p: Profile) {
  return Boolean(p.dni && p.telefono);
}

/* Config visual por estado REPROCANN */
const estadoConfig = {
  aprobado:  {
    border:  'border-emerald-500/40',
    label:   'Aprobado',
    badge:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    icon:    CheckCircle2,
    iconCls: 'text-emerald-400',
    desc:    'Visitá tu perfil de socio.',
  },
  pendiente: {
    border:  'border-amber-500/40',
    label:   'En revisión',
    badge:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    icon:    Clock,
    iconCls: 'text-amber-400',
    desc:    'Tu documentación está siendo revisada por el equipo.',
  },
  rechazado: {
    border:  'border-red-500/40',
    label:   'Rechazado',
    badge:   'bg-red-500/15 text-red-400 border border-red-500/30',
    icon:    XCircle,
    iconCls: 'text-red-400',
    desc:    'Tu certificado fue rechazado. Subí uno nuevo.',
  },
  vencido: {
    border:  'border-gray-500/40',
    label:   'Vencido',
    badge:   'bg-gray-500/15 text-gray-400 border border-gray-500/30',
    icon:    AlertTriangle,
    iconCls: 'text-gray-400',
    desc:    'Tu certificado venció. Renovalo para seguir haciendo pedidos.',
  },
};

export function SocioDashboardClient({ profile, newsletter, notificaciones: notifInicial }: Props) {
  // Newsletter colapsado por defecto; "Ver más" muestra el texto completo
  const [newsExpandido, setNewsExpandido] = useState(false);
  // Credencial REPROCANN de fondo (se oculta sola si el archivo no existe)
  const [credencialOk, setCredencialOk] = useState(true);
  // Notificaciones in-app (pedido confirmado / entregado)
  const [notificaciones, setNotificaciones] = useState(notifInicial);
  const [marcando, startMarcar] = useTransition();
  const noLeidas = notificaciones.filter(n => !n.leida).length;

  const handleMarcarLeidas = () => {
    startMarcar(async () => {
      const res = await marcarNotificacionesLeidas();
      if (res.ok) setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    });
  };

  const datosCompletos = perfilCompleto(profile);
  const certCargado    = Boolean(profile.reprocann_certificado_path);
  // Estado efectivo: vencido por fecha aunque el cron todavía no lo haya marcado
  const estadoRep      = estadoEfectivoReprocann(profile.reprocann_estado, profile.reprocann_vencimiento);
  const aprobado       = estadoRep === 'aprobado';

  const alertas = [
    !datosCompletos && {
      key:   'datos',
      Icon:  UserRound,
      texto: 'Completá tu DNI y teléfono en tu perfil para poder hacer pedidos.',
      cta:   'Completar mis datos',
      href:  '/socio/perfil',
    },
    datosCompletos && !certCargado && {
      key:   'cert',
      Icon:  FileText,
      texto: 'Subí tu certificado REPROCANN para que el equipo lo revise.',
      cta:   'Subir certificado',
      href:  '/socio/perfil',
    },
    datosCompletos && certCargado && estadoRep === 'pendiente' && {
      key:   'revision',
      Icon:  Clock,
      texto: 'Tu documentación está pendiente de aprobación.',
      cta:   'Ver estado',
      href:  '/socio/perfil',
    },
  ].filter(Boolean) as { key: string; Icon: React.ElementType; texto: string; cta: string; href: string }[];

  const estado  = estadoConfig[estadoRep] ?? estadoConfig.pendiente;
  const EstIcon = estado.icon;

  // Alerta de vencimiento del REPROCANN
  const diasParaVencer = profile.reprocann_vencimiento ? diasHasta(profile.reprocann_vencimiento) : null;
  const reprocannVencido  = estadoRep === 'vencido';
  const reprocannPorVencer = aprobado && diasParaVencer !== null && diasParaVencer >= 0 && diasParaVencer <= 90;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">

      {/* Bienvenida */}
      <motion.div variants={fadeUp}>
        <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Bienvenido</p>
        <h1 className="font-avigea text-4xl text-foreground leading-tight">
          Hola, <span className="text-gradient-dorado">{profile.nombre.split(' ')[0]}</span>
        </h1>
        <div className="divider-dorado mt-3" />
      </motion.div>

      {/* Alertas contextuales — estilo barra izquierda */}
      {alertas.map(({ key, Icon, texto, cta, href }) => (
        <motion.div key={key} variants={fadeUp}>
          {/* Toda la tarjeta es clickeable, no solo el CTA */}
          <Link
            href={href}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 border-l-[3px] border-l-amber-400 hover:bg-amber-500/15 hover:border-amber-500/35 transition-colors"
          >
            <Icon className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-amber-200/80 text-sm flex-1">{texto}</p>
            <span className="text-club-dorado text-xs font-semibold group-hover:text-club-dorado/70 transition-colors shrink-0 flex items-center gap-1">
              {cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        </motion.div>
      ))}

      {/* Banner de vencimiento REPROCANN */}
      {reprocannVencido && (
        <motion.div
          variants={fadeUp}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 border-l-[3px] border-l-red-400"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-200/90 text-sm flex-1">
            Tu REPROCANN está <span className="font-semibold">vencido</span>. No vas a poder hacer pedidos hasta renovarlo.
          </p>
          <Link href="/socio/perfil" className="text-club-dorado text-xs font-semibold hover:text-club-dorado/70 transition-colors shrink-0 flex items-center gap-1">
            Renovar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}
      {reprocannPorVencer && (
        <motion.div
          variants={fadeUp}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 border-l-[3px] border-l-amber-400"
        >
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-200/90 text-sm flex-1">
            Tu REPROCANN vence en <span className="font-semibold">{diasParaVencer} {diasParaVencer === 1 ? 'día' : 'días'}</span>. Renovalo para seguir haciendo pedidos.
          </p>
          <Link href="/socio/perfil" className="text-club-dorado text-xs font-semibold hover:text-club-dorado/70 transition-colors shrink-0 flex items-center gap-1">
            Renovar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}

      {/* Grid principal: estado + acciones rápidas */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Card REPROCANN: toda la card es un botón al perfil del socio */}
        <Link
          href="/socio/perfil"
          className={cn('relative overflow-hidden glass-card !bg-[#04231f]/95 border group hover:border-club-dorado/40 hover:shadow-dorado-sm transition-all duration-300', estado.border)}
        >
          {credencialOk && (
            /* Credencial en la mitad derecha, fundida en su borde izquierdo */
            <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
              <Image
                src="/images/reprocann.jpg"
                alt=""
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={() => setCredencialOk(false)}
              />
              {/* Fundido largo y suave hacia la foto */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#04231f] from-0% via-[#04231f]/55 via-40% to-transparent to-95%" />
            </div>
          )}

          <div className="relative z-10 p-5 flex flex-col gap-4 h-full">
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-club-dorado" />
                <span className="text-sm font-semibold text-foreground/80">REPROCANN</span>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', estado.badge)}>
                <EstIcon className="w-3.5 h-3.5" />
                {estado.label}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{estado.desc}</p>

            {profile.reprocann_vencimiento && (
              <p className="text-xs text-muted-foreground mt-auto">
                Vence: <span className="text-foreground font-medium">{formatFecha(profile.reprocann_vencimiento)}</span>
              </p>
            )}
          </div>
        </Link>

        {/* Acceso rápido — Catálogo: el verde se funde con la foto */}
        <Link
          href="/socio/tienda"
          className="relative overflow-hidden rounded-xl border border-white/5 bg-[#04231f]/95 hover:border-club-dorado/40 hover:shadow-dorado-sm transition-all duration-300 group min-h-[11rem] flex"
        >
          {/* Foto en la mitad derecha, fundida en su borde izquierdo */}
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <Image
              src="/images/fondo-boton-catalogo.png"
              alt=""
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            />
            {/* Fundido largo y suave hacia la foto */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#04231f] from-0% via-[#04231f]/55 via-40% to-transparent to-95%" />
          </div>

          <div className="relative z-10 p-5 flex flex-col gap-3 w-3/5">
            <div className="w-10 h-10 rounded-xl bg-club-dorado/15 border border-club-dorado/25 backdrop-blur-sm flex items-center justify-center text-club-dorado group-hover:bg-club-dorado/30 transition-colors">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-avigea text-2xl text-foreground">Catálogo 2026</p>
              <p className="text-muted-foreground text-xs mt-0.5">Visitá nuestra selección de genéticas</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-club-dorado mt-auto">
              Explorar <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        {/* Acceso rápido — Pedidos: mismo lenguaje, ícono gigante fantasma */}
        <Link
          href="/socio/pedidos"
          className="relative overflow-hidden rounded-xl border border-white/5 bg-[#04231f]/95 hover:border-club-dorado/40 hover:shadow-dorado-sm transition-all duration-300 group min-h-[11rem] flex"
        >
          {/* Foto en la mitad derecha, fundida en su borde izquierdo */}
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <Image
              src="/images/pedidos.jpg"
              alt=""
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#04231f] from-0% via-[#04231f]/55 via-40% to-transparent to-95%" />
          </div>

          <div className="relative z-10 p-5 flex flex-col gap-3 w-3/5">
            <div className="w-10 h-10 rounded-xl bg-club-dorado/15 border border-club-dorado/25 flex items-center justify-center text-club-dorado group-hover:bg-club-dorado/30 transition-colors">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-avigea text-2xl text-foreground">Mis pedidos</p>
              <p className="text-muted-foreground text-xs mt-0.5">Historial y estados</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-club-dorado mt-auto">
              Ver historial <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

      </motion.div>

      {/* Notificaciones del club */}
      {notificaciones.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">
              <span className="relative">
                <Bell className="w-5 h-5 text-club-dorado" />
                {noLeidas > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-club-dorado text-club-verde text-[10px] font-bold flex items-center justify-center">
                    {noLeidas}
                  </span>
                )}
              </span>
              Notificaciones
            </h2>
            {noLeidas > 0 && (
              <button
                onClick={handleMarcarLeidas}
                disabled={marcando}
                className="text-club-dorado text-xs hover:text-club-dorado-claro transition-colors flex items-center gap-1.5"
              >
                {marcando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Marcar como leídas
              </button>
            )}
          </div>

          {/* Altura de ~2 notificaciones; el resto se scrollea */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {notificaciones.map(n => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors',
                  n.leida
                    ? 'bg-club-verde-claro/10 border-transparent opacity-70'
                    : 'bg-club-dorado/8 border-club-dorado/20'
                )}
              >
                <span className={cn(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  n.leida ? 'bg-muted-foreground/30' : 'bg-club-dorado animate-pulse'
                )} />
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-semibold">{n.titulo}</p>
                  {n.mensaje && <p className="text-muted-foreground text-xs mt-0.5">{n.mensaje}</p>}
                  <p className="text-muted-foreground/60 text-[11px] mt-1">
                    {formatFecha(n.created_at, "dd MMM · HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Newsletter destacado */}
      {newsletter && (
        <motion.div variants={fadeUp} className="glass-card overflow-hidden">
          {/* Franja superior dorada */}
          <div className="h-1 bg-gradient-to-r from-club-dorado/60 via-club-dorado to-club-dorado/60" />

          {/* Imagen de portada */}
          {newsletter.imagen_url && (
            <div className="relative h-48 sm:h-56">
              <Image src={newsletter.imagen_url} alt={newsletter.titulo} fill className="object-cover" />
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center gap-2 mb-3 text-club-dorado">
              <Newspaper className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Novedades del club</span>
            </div>

            <h2 className="font-avigea text-2xl text-foreground mb-2">{newsletter.titulo}</h2>

            {newsletter.fecha_publicacion && (
              <p className="text-muted-foreground text-xs mb-4">
                {formatFecha(newsletter.fecha_publicacion, "dd 'de' MMMM 'de' yyyy")}
              </p>
            )}

            <div className={cn(
              'prose prose-sm prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground',
              !newsExpandido && 'line-clamp-4'
            )}>
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>{newsletter.contenido}</ReactMarkdown>
            </div>

            <button
              onClick={() => setNewsExpandido(v => !v)}
              className="mt-3 flex items-center gap-1 text-club-dorado text-xs font-semibold hover:text-club-dorado/80 transition-colors"
            >
              {newsExpandido ? 'Ver menos' : 'Ver más'}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', newsExpandido && 'rotate-180')} />
            </button>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
