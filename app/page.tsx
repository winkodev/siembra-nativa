'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Leaf, Users, FileCheck } from 'lucide-react';

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const features = [
  {
    icon: <Leaf className="w-6 h-6" />,
    titulo: 'Catálogo de Genéticas',
    desc:   'Explorá nuestras variedades disponibles con información detallada de THC, CBD y perfiles.',
  },
  {
    icon: <FileCheck className="w-6 h-6" />,
    titulo: 'Control REPROCANN',
    desc:   'Cargá tu certificado y seguí el estado de tu habilitación en tiempo real.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    titulo: 'Privacidad Total',
    desc:   'Tus datos de salud están protegidos bajo la Ley 25.326. Acceso estrictamente controlado.',
  },
  {
    icon: <Users className="w-6 h-6" />,
    titulo: 'Comunidad',
    desc:   'Mantenete informado con el newsletter del club y las novedades de la comunidad.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden flex flex-col">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-club-dorado/5 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-club-verde-claro/15 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #F3A707 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ---- BOTÓN ACCESO (esquina superior derecha) ---- */}
      <motion.div
        className="relative z-10 flex justify-end px-6 pt-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <Link href="/login" className="btn-secondary text-sm">
          Acceso socios
        </Link>
      </motion.div>

      {/* ---- HERO CENTRADO ---- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          className="flex flex-col items-center text-center max-w-2xl mx-auto"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >

          {/* Logo badge grande y centrado */}
          <motion.div
            variants={fadeUp}
            className="relative mb-8"
          >
            {/* Halo dorado detrás del logo */}
            <div className="absolute inset-0 rounded-full bg-club-dorado/15 blur-3xl scale-125" />
            <Image
              src="/images/logo.png"
              alt="Siembra Nativa Club"
              width={280}
              height={280}
              className="relative object-contain drop-shadow-2xl animate-float"
              priority
            />
          </motion.div>

          {/* Logo texto */}
          <motion.div variants={fadeUp} className="mb-6">
            <Image
              src="/images/logo-text.png"
              alt="Siembra Nativa"
              width={380}
              height={128}
              className="object-contain"
              priority
            />
          </motion.div>

          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-club-dorado/30 bg-club-dorado/10 text-club-dorado text-sm font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-club-dorado animate-pulse" />
              Plataforma para socios
            </span>
          </motion.div>

          {/* Subtítulo */}
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-md mb-10 leading-relaxed">
            Club de cultivo de cannabis medicinal en Argentina.
            Gestioná tu habilitación REPROCANN, explorá genéticas y realizá tus pedidos.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="btn-primary text-base px-8 py-4">
              Acceso socios
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/registro" className="btn-secondary text-base px-8 py-4">
              Registrarme
            </Link>
          </motion.div>

        </motion.div>

        {/* ---- FEATURES GRID ---- */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-20 w-full max-w-6xl"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {features.map((f) => (
            <motion.div
              key={f.titulo}
              variants={fadeUp}
              className="glass-card p-6 border-dorado-hover group"
            >
              <div className="w-12 h-12 rounded-xl bg-club-dorado/15 border border-club-dorado/20 flex items-center justify-center text-club-dorado mb-4 group-hover:bg-club-dorado/25 transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="font-avigea text-lg text-foreground mb-2">{f.titulo}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ---- BANNER LEGAL ---- */}
        <motion.div
          className="mt-10 w-full max-w-6xl glass-card p-5 border border-club-dorado/20 flex flex-col md:flex-row items-center gap-4 text-center md:text-left"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Shield className="w-8 h-8 text-club-dorado flex-shrink-0" />
          <div>
            <p className="text-sm text-foreground font-semibold mb-0.5">Plataforma privada — Acceso exclusivo para socios habilitados</p>
            <p className="text-xs text-muted-foreground">
              Los datos de salud y certificados REPROCANN están protegidos bajo la Ley 25.326 de Protección de Datos Personales de la República Argentina.
            </p>
          </div>
        </motion.div>

      </main>

      {/* ---- FOOTER ---- */}
      <footer className="relative z-10 border-t border-club-verde-claro/30 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} Siembra Nativa Club. Todos los derechos reservados.</p>
          <p className="text-muted-foreground text-xs">Cannabis medicinal regulado · Ley 27.350 · Argentina</p>
        </div>
      </footer>

    </div>
  );
}
