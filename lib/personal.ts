import type { Personal, PersonalSueldo, PersonalPago, PersonalRetiro, TipoPagoPersonal } from '@/lib/types/database';

// Cuentas de sueldos, aguinaldo y retiros. Módulo puro: lo usan servidor y cliente.

// Retiro con lo ya descontado (empleado) o cobrado (socio administrador)
export type RetiroVista = PersonalRetiro & { genetica: string; cubierto: number; pendiente: number };
export type PersonalVista = Personal & {
  sueldos: PersonalSueldo[];   // del más nuevo al más viejo
  pagos: PersonalPago[];       // incluye anulados
  retiros: RetiroVista[];      // incluye anulados
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Fecha de hoy en Argentina (el servidor corre en UTC)
export function hoyAR(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function primerDia(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}
export function etiquetaPeriodo(tipo: TipoPagoPersonal, periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  return `${tipo === 'sueldo' ? 'Sueldo' : 'Aguinaldo'} ${MESES[m - 1]} ${y}`;
}

// Sueldo vigente en un mes (primer día). null si todavía no tenía.
export function sueldoEn(p: PersonalVista, periodo: string): number | null {
  return p.sueldos.find(s => s.desde <= periodo)?.monto ?? null;
}

// Primer sueldo que se paga desde la app: lo anterior ya estaba pago
export function primerSueldo(p: PersonalVista) {
  return p.sueldos.length > 0 ? p.sueldos[p.sueldos.length - 1] : null;
}

export function retirosPendientes(p: PersonalVista): number {
  return p.retiros.filter(r => !r.anulado_at && !r.deuda_id).reduce((a, r) => a + r.pendiente, 0);
}

// Semestre al que pertenece una fecha: pago en junio o diciembre
export function semestreDe(fecha: string): { inicio: string; fin: string; periodo: string } {
  const y = fecha.slice(0, 4);
  return Number(fecha.slice(5, 7)) <= 6
    ? { inicio: `${y}-01-01`, fin: `${y}-06-30`, periodo: `${y}-06-01` }
    : { inicio: `${y}-07-01`, fin: `${y}-12-31`, periodo: `${y}-12-01` };
}
function dias(desde: string, hasta: string): number {
  return Math.max(Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1, 0);
}

// 50% del mejor sueldo del semestre, entero aunque no lo haya trabajado completo.
// Con `hasta`: la parte que hay que tener reservada a esa fecha.
export function aguinaldoSugerido(p: PersonalVista, periodo: string, hasta?: string): number {
  const sem = semestreDe(periodo);
  const desde = p.fecha_ingreso > sem.inicio ? p.fecha_ingreso : sem.inicio;
  const tope = hasta && hasta < sem.fin ? hasta : sem.fin;
  if (desde > tope) return 0;
  // Mejor sueldo: el que traía al empezar y los que arrancan dentro del semestre.
  // Los meses anteriores al primer sueldo cargado se toman con ese sueldo.
  const mejor = Math.max(0, sueldoEn(p, primerDia(desde)) ?? primerSueldo(p)?.monto ?? 0,
    ...p.sueldos.filter(s => s.desde >= desde && s.desde <= tope).map(s => s.monto));
  return Math.round((mejor / 2) * (dias(sem.inicio, tope) / dias(sem.inicio, sem.fin)));
}

// Estado de un período: base, extras y pagos vigentes, y lo que falta
export function liquidacion(p: PersonalVista, tipo: TipoPagoPersonal, periodo: string) {
  const pagos = p.pagos.filter(g => !g.anulado_at && g.tipo === tipo && g.periodo === periodo);
  const suma = (k: 'extra' | 'retiros' | 'monto') => pagos.reduce((a, g) => a + g[k], 0);
  // Aguinaldo en partes: vale la base del último pago
  const base = tipo === 'sueldo'
    ? sueldoEn(p, periodo) ?? 0
    : pagos.length > 0 ? pagos[pagos.length - 1].base : aguinaldoSugerido(p, periodo);
  const extra = suma('extra'), retiros = suma('retiros'), pagado = suma('monto');
  return { base, extra, retiros, pagado, hayPagos: pagos.length > 0, falta: Math.round((base + extra - retiros - pagado) * 100) / 100 };
}
