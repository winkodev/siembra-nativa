import Image from 'next/image';
import { Loader2 } from 'lucide-react';

// Loader de página: se muestra al instante mientras el servidor
// prepara los datos de la ruta (via loading.tsx de cada sección)
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5">
      <div className="relative w-20 h-20 rounded-full bg-club-dorado/10 border border-club-dorado/25 flex items-center justify-center animate-pulse-dorado">
        <Image
          src="/images/logo.png"
          alt="Siembra Nativa Club"
          width={48}
          height={48}
          className="object-contain animate-float"
          priority
        />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 text-club-dorado animate-spin" />
        Cargando...
      </div>
    </div>
  );
}
