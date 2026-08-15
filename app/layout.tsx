import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Siembra Nativa Club',
    template: '%s | Siembra Nativa Club',
  },
  description: 'Club de cultivo de cannabis medicinal. Gestión de socios, inventario y REPROCANN.',
  keywords: ['cannabis medicinal', 'REPROCANN', 'cultivo', 'club', 'Argentina'],
  robots: {
    // Índice bloqueado: plataforma privada de socios
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* Precargar fuentes del club */}
        <link rel="preload" href="/fonts/Avigea.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/CenturyGothic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
