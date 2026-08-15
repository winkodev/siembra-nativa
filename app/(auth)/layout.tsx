import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceso',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-hero flex">

      {/* Panel izquierdo - Solo visible en desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-16 overflow-hidden">

        {/* Fondo decorativo */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-[10%] left-[20%] w-80 h-80 rounded-full bg-club-dorado/8 blur-[80px]" />
          <div className="absolute bottom-[15%] right-[10%] w-60 h-60 rounded-full bg-club-verde-claro/25 blur-[60px]" />
          {/* Grid de puntos */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #F3A707 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Contenido del panel */}
        <div className="relative z-10 flex flex-col items-center text-center gap-10">

          {/* Logo grande */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-club-dorado/20 blur-2xl scale-110" />
              <Image
                src="/images/logo.png"
                alt="Siembra Nativa Club"
                width={240}
                height={240}
                className="relative object-contain drop-shadow-2xl animate-float"
                priority
              />
            </div>
            <Image
              src="/images/logo-text.png"
              alt="Siembra Nativa"
              width={360}
              height={121}
              className="object-contain"
              priority
            />
          </div>

          {/* Tagline */}
          <div className="glass-card px-8 py-6 text-center max-w-sm">
            <p className="text-foreground/90 text-base leading-relaxed">
              Club de cultivo de cannabis medicinal.
              <br />
              <span className="text-club-dorado font-semibold">Comunidad, salud y privacidad.</span>
            </p>
          </div>

          {/* Legal */}
          <p className="text-muted-foreground text-xs max-w-xs leading-relaxed">
            Plataforma privada para socios habilitados.
            Datos protegidos bajo Ley 25.326 · Argentina.
          </p>

        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <Image src="/images/logo.png" alt="Logo" width={44} height={44} className="object-contain" />
          <Image src="/images/logo-text.png" alt="Siembra Nativa" width={140} height={47} className="object-contain" />
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>

        {/* Link volver */}
        <Link href="/" className="mt-8 text-muted-foreground hover:text-club-dorado text-sm transition-colors">
          ← Volver al inicio
        </Link>

      </div>
    </div>
  );
}
