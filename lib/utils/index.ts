import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ReprocannEstado, EstadoPedido } from '@/lib/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatear fecha en español
export function formatFecha(date: string | Date, formato = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formato, { locale: es });
}

// Días restantes hasta una fecha
export function diasHasta(fecha: string): number {
  return differenceInDays(parseISO(fecha), new Date());
}

// Clase CSS para badge de REPROCANN
export function badgeReprocann(estado: ReprocannEstado): string {
  const map: Record<ReprocannEstado, string> = {
    pendiente: 'badge-reprocann-pendiente',
    aprobado:  'badge-reprocann-aprobado',
    rechazado: 'badge-reprocann-rechazado',
    vencido:   'badge-reprocann-vencido',
  };
  return map[estado];
}

// Label legible para estado REPROCANN
export function labelReprocann(estado: ReprocannEstado): string {
  const map: Record<ReprocannEstado, string> = {
    pendiente: 'Pendiente',
    aprobado:  'Aprobado',
    rechazado: 'Rechazado',
    vencido:   'Vencido',
  };
  return map[estado];
}

// Clase CSS para badge de pedido
export function badgePedido(estado: EstadoPedido): string {
  const map: Record<EstadoPedido, string> = {
    pendiente: 'badge-pedido-pendiente',
    aprobado:  'badge-pedido-aprobado',
    entregado: 'badge-pedido-entregado',
    cancelado: 'badge-pedido-cancelado',
  };
  return map[estado];
}

// Label legible para tipo de genética
export function labelTipo(tipo: string): string {
  const map: Record<string, string> = {
    indica:  'Índica',
    sativa:  'Sativa',
    hibrida: 'Híbrida',
  };
  return map[tipo] ?? tipo;
}

// Labels de calidad y cultivo de genética
export function labelCalidad(calidad: string): string {
  return calidad === 'premium' ? 'Premium' : 'Regular';
}

export function labelCultivo(cultivo: string): string {
  return cultivo === 'indoor' ? 'Indoor' : 'Outdoor';
}

// Estado efectivo del REPROCANN: si está aprobado pero la fecha ya pasó,
// se muestra como vencido aunque el cron diario todavía no lo haya marcado.
export function estadoEfectivoReprocann(estado: ReprocannEstado, vencimiento: string | null): ReprocannEstado {
  if (estado === 'aprobado' && vencimiento && diasHasta(vencimiento) < 0) return 'vencido';
  return estado;
}

// Label legible para categoría de producto
export function labelCategoriaProducto(cat: string): string {
  const map: Record<string, string> = {
    aceite:        'Aceite',
    merchandising: 'Merchandising',
    otro:          'Otro',
  };
  return map[cat] ?? cat;
}

// Formatear gramos
export function formatGramos(gramos: number): string {
  if (gramos >= 1000) return `${(gramos / 1000).toFixed(1)} kg`;
  return `${gramos.toFixed(0)} g`;
}

// Formatear montos en pesos: "$ 1.500"
export function formatPrecio(monto: number): string {
  return '$ ' + monto.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Número de orden con ceros a la izquierda: "#0012"
export function formatNumeroPedido(numero: number | null | undefined): string {
  return numero != null ? `#${String(numero).padStart(4, '0')}` : '#—';
}

// Etiqueta legible de una franja horaria: "Sábados · 09:00–18:00 hs".
// Si la franja tiene días como dato, la etiqueta sale de ahí; si no, del texto viejo.
export function formatFranja(f: { dia: string; dias_semana?: number[] | null; hora_desde: string; hora_hasta: string }): string {
  const dia = f.dias_semana && f.dias_semana.length > 0 ? labelDias(f.dias_semana) : f.dia;
  return `${dia} · ${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)} hs`;
}

// Días de la semana (0 = domingo, como EXTRACT(DOW) en Postgres y getDay() en JS)
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

// Etiqueta legible de un conjunto de días: "Sábados", "Lunes a Viernes", "Lun, Mié, Vie"
export function labelDias(dias: number[]): string {
  const d = Array.from(new Set(dias)).filter(n => n >= 0 && n <= 6).sort((a, b) => a - b);
  if (d.length === 0) return 'Sin día';
  if (d.length === 7) return 'Todos los días';
  if (d.length === 1) return DIAS_SEMANA[d[0]] + 's';
  const esRango = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  if (esRango && d.length >= 3) return `${DIAS_SEMANA[d[0]]} a ${DIAS_SEMANA[d[d.length - 1]]}`;
  return d.map(n => DIAS_CORTOS[n]).join(', ');
}
