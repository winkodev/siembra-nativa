'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Move, Newspaper, Pin, X } from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';

// Lo que hace falta para mostrar una novedad (sirve también para la vista previa sin guardar)
export interface NovedadVista {
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  imagen_pos_x: number;
  imagen_pos_y: number;
  fecha_publicacion: string | null;
  fijada?: boolean;
}

// Proporción de la imagen en la tarjeta: la misma en el inicio del socio y en la vista previa
export const PROPORCION_TARJETA = 'aspect-[2/1]';

// Texto plano para el resumen de la tarjeta
function resumen(md: string) {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const fecha = (n: NovedadVista) => n.fecha_publicacion ? formatFecha(n.fecha_publicacion, "dd 'de' MMMM 'de' yyyy") : 'Sin publicar';

// Tarjeta de la lista de novedades
export function NovedadTarjeta({ novedad, nueva = false, onClick }: { novedad: NovedadVista; nueva?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="glass-card overflow-hidden text-left w-full flex flex-col group border border-transparent hover:border-club-dorado/30 transition-colors">
      <div className={cn('relative w-full bg-club-verde-claro/20', PROPORCION_TARJETA)}>
        {novedad.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={novedad.imagen_url} alt={novedad.titulo} className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${novedad.imagen_pos_x}% ${novedad.imagen_pos_y}%` }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20"><Newspaper className="w-10 h-10" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {novedad.fijada && <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Pin className="w-3 h-3" /> Destacada</span>}
          {nueva && <span className="px-2 py-0.5 rounded-full bg-club-dorado text-club-verde text-[10px] font-bold uppercase tracking-wider">Nueva</span>}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <p className="text-muted-foreground text-[11px]">{fecha(novedad)}</p>
        <h3 className="font-avigea text-lg text-foreground leading-tight group-hover:text-club-dorado transition-colors">{novedad.titulo || 'Sin título'}</h3>
        <p className="text-muted-foreground text-sm line-clamp-3">{resumen(novedad.contenido)}</p>
        <span className="mt-auto pt-2 text-club-dorado text-xs font-semibold">Leer completa</span>
      </div>
    </button>
  );
}

// Popup con la novedad entera y la imagen completa, sin recortar
export function NovedadModal({ novedad, onClose }: { novedad: NovedadVista; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="glass-card w-full max-w-3xl max-h-[92vh] overflow-y-auto relative">
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
          <X className="w-4 h-4" />
        </button>
        <div className="h-1 bg-gradient-to-r from-club-dorado/60 via-club-dorado to-club-dorado/60" />
        {novedad.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={novedad.imagen_url} alt={novedad.titulo} className="w-full max-h-[60vh] object-contain bg-black" />
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3 text-club-dorado">
            <Newspaper className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Novedades del club</span>
          </div>
          <h2 className="font-avigea text-2xl text-foreground mb-1">{novedad.titulo || 'Sin título'}</h2>
          <p className="text-muted-foreground text-xs mb-4">{fecha(novedad)}</p>
          <div className="prose prose-sm prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-club-dorado">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{novedad.contenido}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

// Encuadre: se arrastra la imagen para elegir qué parte se ve en la tarjeta
export function EncuadreImagen({ src, x, y, onChange }: { src: string; x: number; y: number; onChange: (x: number, y: number) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const arrastre = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // Cuánto sobra de imagen fuera de la caja, en px, con object-cover
  const sobrante = () => {
    const c = caja.current;
    if (!c || !natural) return { sx: 0, sy: 0 };
    const escala = Math.max(c.clientWidth / natural.w, c.clientHeight / natural.h);
    return { sx: natural.w * escala - c.clientWidth, sy: natural.h * escala - c.clientHeight };
  };
  const limitar = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

  return (
    <div ref={caja}
      className={cn('relative w-full overflow-hidden rounded-xl cursor-grab active:cursor-grabbing touch-none select-none bg-black', PROPORCION_TARJETA)}
      onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); arrastre.current = { px: e.clientX, py: e.clientY, x, y }; }}
      onPointerMove={e => {
        const a = arrastre.current;
        if (!a) return;
        const { sx, sy } = sobrante();
        // Arrastrar a la derecha muestra lo que está a la izquierda
        onChange(sx > 0 ? limitar(a.x - ((e.clientX - a.px) / sx) * 100) : 50, sy > 0 ? limitar(a.y - ((e.clientY - a.py) / sy) * 100) : 50);
      }}
      onPointerUp={() => { arrastre.current = null; }}
      onPointerCancel={() => { arrastre.current = null; }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${x}% ${y}%` }} />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] flex items-center gap-1.5 pointer-events-none">
        <Move className="w-3 h-3" /> Arrastrá para elegir qué se ve
      </span>
    </div>
  );
}
