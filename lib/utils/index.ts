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

// Label legible para categoría REPROCANN
export function labelCategoria(cat: string): string {
  const map: Record<string, string> = {
    paciente_cultiva:   'Paciente que cultiva',
    tercero_cultivador: 'Tercero cultivador',
    ong:                'ONG',
  };
  return map[cat] ?? cat;
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

// Verificar si REPROCANN está vigente para hacer pedidos
export function reprocannVigente(estado: ReprocannEstado, vencimiento: string | null): boolean {
  if (estado !== 'aprobado') return false;
  if (!vencimiento) return false;
  return diasHasta(vencimiento) >= 0;
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

// Número de orden con ceros a la izquierda: "#0012"
export function formatNumeroPedido(numero: number | null | undefined): string {
  return numero != null ? `#${String(numero).padStart(4, '0')}` : '#—';
}

// Etiqueta legible de una franja horaria: "Sábados · 09:00–18:00 hs"
export function formatFranja(f: { dia: string; hora_desde: string; hora_hasta: string }): string {
  return `${f.dia} · ${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)} hs`;
}
