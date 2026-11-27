// Cotización del dólar (oficial y blue) desde dolarapi.com, sin clave.
// Se cachea 15 minutos; si la API falla devuelve null y nada se rompe.
export interface Cotizacion { compra: number; venta: number }
export interface Cotizaciones { oficial: Cotizacion | null; blue: Cotizacion | null; actualizado: string | null }

export async function obtenerCotizaciones(): Promise<Cotizaciones | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const lista = (await res.json()) as { casa: string; compra: number; venta: number; fechaActualizacion: string }[];
    const de = (casa: string) => {
      const c = lista.find(x => x.casa === casa);
      return c && c.venta > 0 ? { compra: Number(c.compra), venta: Number(c.venta) } : null;
    };
    const fechas = lista.filter(x => x.casa === 'oficial' || x.casa === 'blue').map(x => x.fechaActualizacion).sort();
    return { oficial: de('oficial'), blue: de('blue'), actualizado: fechas[fechas.length - 1] ?? null };
  } catch {
    return null;
  }
}
