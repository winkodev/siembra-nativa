'use client';

import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { formatPrecio } from '@/lib/utils';
import type { Cotizaciones } from '@/lib/dolar';

// Cotización del día (oficial y blue). null mientras carga o si la API no responde.
export function useCotizaciones(): Cotizaciones | null {
  const [c, setC] = useState<Cotizaciones | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/dolar').then(r => (r.ok ? r.json() : null)).then(d => { if (vivo) setC(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return c;
}

// Chip con el valor de venta de cada dólar
export function CotizacionDolar() {
  const c = useCotizaciones();
  if (!c || (!c.oficial && !c.blue)) return null;
  const hora = c.actualizado ? new Date(c.actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="glass-card rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" title={hora ? `Actualizado ${hora} · dolarapi.com` : undefined}>
      <DollarSign className="w-4 h-4 text-club-dorado" />
      {c.oficial && <span className="text-muted-foreground">Oficial <b className="text-foreground tabular-nums">{formatPrecio(c.oficial.venta)}</b></span>}
      {c.blue && <span className="text-muted-foreground">Blue <b className="text-foreground tabular-nums">{formatPrecio(c.blue.venta)}</b></span>}
    </div>
  );
}
