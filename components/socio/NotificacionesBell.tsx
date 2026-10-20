'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { marcarNotificacionesLeidas } from '@/app/actions/notificaciones';
import { cn, formatFecha } from '@/lib/utils';
import type { Notificacion } from '@/lib/types/database';

// Campana de notificaciones del socio (estilo YouTube): badge con las no leídas
// y un panel desplegable. Al abrir el panel se marcan todas como leídas.
export function NotificacionesBell() {
  const [items, setItems]   = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const cargar = async () => {
    const { data } = await createClient()
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data as Notificacion[]) ?? []);
  };

  useEffect(() => { cargar(); }, []);

  // Cerrar al hacer clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return;
    const click = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const noLeidas = items.filter(n => !n.leida).length;

  const abrir = async () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo) {
      await cargar();
      if (items.some(n => !n.leida)) {
        // El badge se apaga al abrir, como en YouTube; el punto de cada item se mantiene hasta recargar
        const res = await marcarNotificacionesLeidas();
        if (res.ok) setTimeout(() => setItems(prev => prev.map(n => ({ ...n, leida: true }))), 1500);
      }
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={abrir}
        aria-label={noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : 'Notificaciones'}
        className={cn(
          'relative w-11 h-11 rounded-full flex items-center justify-center border transition-all',
          abierto
            ? 'bg-club-dorado text-club-verde border-club-dorado'
            : 'bg-club-verde border-club-verde-claro/40 text-foreground hover:border-club-dorado/50'
        )}
      >
        <motion.div animate={noLeidas > 0 && !abierto ? { rotate: [0, -12, 10, -8, 6, 0] } : { rotate: 0 }}
          transition={noLeidas > 0 && !abierto ? { duration: 0.8, repeat: Infinity, repeatDelay: 4 } : { duration: 0.2 }}>
          <Bell className="w-5 h-5" />
        </motion.div>
        {noLeidas > 0 && (
          <motion.span key={noLeidas} initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-club-verde">
            {noLeidas > 9 ? '9+' : noLeidas}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="absolute right-0 mt-2 w-[min(92vw,380px)] bg-club-verde border border-club-verde-claro/30 rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-club-verde-claro/30">
              <p className="font-avigea text-lg text-foreground">Notificaciones</p>
              <button onClick={() => setAbierto(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground text-sm">No tenés notificaciones.</p>
                </div>
              ) : (
                <ul className="divide-y divide-club-verde-claro/15">
                  {items.map(n => (
                    <li key={n.id} className={cn('px-4 py-3 flex gap-3', !n.leida && 'bg-club-dorado/5')}>
                      <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', n.leida ? 'bg-muted-foreground/30' : 'bg-club-dorado')} />
                      <div className="min-w-0">
                        <p className={cn('text-sm leading-snug', n.leida ? 'text-foreground/80' : 'text-foreground font-semibold')}>{n.titulo}</p>
                        {n.mensaje && <p className="text-muted-foreground text-xs mt-0.5 leading-snug">{n.mensaje}</p>}
                        <p className="text-muted-foreground/70 text-[11px] mt-1">{formatFecha(n.created_at, "dd MMM · HH:mm")}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {items.length > 0 && (
              <div className="px-4 py-2 border-t border-club-verde-claro/30 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3 h-3" /> Al abrir este panel quedan marcadas como leídas.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
