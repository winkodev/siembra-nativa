import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ReposicionGenetica, TesSaldo, Moneda } from '@/lib/types/database';
import { cargarPersonal } from '@/lib/personal-datos';
import { obtenerCotizaciones } from '@/lib/dolar';
import { aguinaldoSugerido, etiquetaPeriodo, hoyAR, liquidacion, primerDia, retirosPendientes, semestreDe } from '@/lib/personal';

interface Grupo { total: number; detalle: { nombre: string; monto: number }[] }

export interface Objetivos {
  reposicion: ReposicionGenetica[];
  // Dólar blue de hoy: valúa la reposición de lo comprado en dólares (null si no se pudo traer)
  dolar: number | null;
  // Pesos
  reponer: number;
  sueldos: { total: number; detalle: { nombre: string; monto: number }[] };
  aguinaldo: { total: number; detalle: { nombre: string; monto: number }[] };
  fijos: { total: number; detalle: { nombre: string; monto: number }[] };
  necesario: number;
  real: number;
  // Con los pedidos pendientes: entra su plata y hay que reponer lo que se llevan
  pendientes: { pedidos: number; monto: number; reponer: number };
  // Dólares, aparte
  usd: { fijos: Grupo; necesario: number; disponible: number };
}

// Cuánta plata hay que juntar y cuánta hay. No mueve nada.
export async function cargarObjetivos(supabase: SupabaseClient<Database>): Promise<Objetivos | null> {
  const hoy = hoyAR();
  // Lo que hay que pagar hasta fin del mes que viene. Las deudas no cuentan:
  // las compras de stock se juntan con la reposición y las cuotas con gastos fijos.
  const [anio, nMes] = hoy.split('-').map(Number);
  const proxMes = new Date(Date.UTC(anio, nMes, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(anio, nMes + 1, 0)).toISOString().slice(0, 10);

  const [{ data: repo, error }, personal, { data: saldos }, { data: pend }, { data: deudas }, { data: pagosDeuda }, { data: tareas, error: errorTareas }, cotizaciones] = await Promise.all([
    supabase.rpc('objetivo_reposicion'),
    cargarPersonal(supabase),
    supabase.rpc('tes_saldos'),
    supabase.from('pedidos').select('monto_total').eq('estado', 'pendiente').gt('monto_total', 0),
    supabase.from('tes_deudas').select('id, monto').eq('sentido', 'a_pagar').eq('anulada', false),
    supabase.from('tes_movimientos').select('deuda_id, monto').not('deuda_id', 'is', null),
    supabase.from('tareas').select('titulo, monto, moneda, deuda_id, vence_at').eq('recurrencia', 'mensual').is('hecha_at', null).not('monto', 'is', null).order('vence_at'),
    obtenerCotizaciones(),
  ]);
  if (error || errorTareas || !personal) return null;

  // Lo comprado en dólares se repone al dólar de hoy; si no hay cotización, al de la compra
  const dolar = cotizaciones?.blue?.venta ?? null;
  const reposicion = ((repo ?? []) as ReposicionGenetica[]).map(r => {
    const costoUsd = r.costo_usd != null ? Number(r.costo_usd) : null;
    return {
      ...r, gramos: Number(r.gramos), pendientes: Number(r.pendientes), costo_usd: costoUsd,
      costo: costoUsd != null && dolar ? costoUsd * dolar : Number(r.costo),
    };
  });
  const incluidas = reposicion.filter(r => r.reponer);
  const reponer = incluidas.reduce((a, r) => a + r.gramos * r.costo, 0);

  const empleados = personal.filter(p => p.activo && p.tipo === 'empleado');
  const mes = primerDia(hoy);
  const detSueldos = empleados
    .map(p => {
      // Próximo sueldo: el de este mes o, si ya está pago, el que viene
      const esteMes = liquidacion(p, 'sueldo', mes).falta;
      const periodo = esteMes > 0 ? mes : proxMes;
      const falta = esteMes > 0 ? esteMes : liquidacion(p, 'sueldo', proxMes).falta;
      return { nombre: `${p.nombre} · ${etiquetaPeriodo('sueldo', periodo)}`, monto: Math.max(falta - retirosPendientes(p), 0) };
    })
    .filter(d => d.monto > 0);
  // Aguinaldo: se junta de a poco; entero desde el mes anterior al pago. Menos lo ya pagado.
  const sem = semestreDe(hoy);
  const detAguinaldo = empleados.map(p => {
    const l = liquidacion(p, 'aguinaldo', sem.periodo);
    return { nombre: p.nombre, monto: Math.max(l.hayPagos ? l.falta : aguinaldoSugerido(p, sem.periodo, sem.periodo <= hasta ? undefined : hoy), 0) };
  }).filter(d => d.monto > 0);

  const pagado = new Map<string, number>();
  for (const m of pagosDeuda ?? []) if (m.deuda_id) pagado.set(m.deuda_id, (pagado.get(m.deuda_id) ?? 0) + Number(m.monto));
  const saldo = new Map((deudas ?? []).map(d => [d.id, Math.max(Number(d.monto) - (pagado.get(d.id) ?? 0), 0)]));
  // Gastos fijos vencidos o hasta fin del mes que viene. Una cuota nunca supera lo que queda de su deuda.
  // Si comparten deuda, cada cuota usa el saldo que dejó la anterior.
  const fijos = (tareas ?? []).filter(t => t.vence_at <= hasta).map(t => {
    let monto = Number(t.monto);
    if (t.deuda_id) {
      const queda = saldo.get(t.deuda_id) ?? 0;
      monto = Math.min(monto, queda);
      saldo.set(t.deuda_id, queda - monto);
    }
    return { nombre: t.titulo, moneda: t.moneda, monto };
  }).filter(f => f.monto > 0);
  const fijosEn = (moneda: Moneda) => fijos.filter(f => f.moneda === moneda).map(f => ({ nombre: f.nombre, monto: f.monto }));
  const detFijos = fijosEn('ARS'), usdFijos = fijosEn('USD');

  const suma = (l: { monto: number }[]) => l.reduce((a, x) => a + x.monto, 0);
  const disponible = (moneda: Moneda) => ((saldos ?? []) as TesSaldo[]).filter(s => s.moneda === moneda).reduce((a, s) => a + Number(s.saldo), 0);
  const grupo = (detalle: { nombre: string; monto: number }[]) => ({ total: suma(detalle), detalle });

  return {
    reposicion, dolar, reponer,
    sueldos: grupo(detSueldos), aguinaldo: grupo(detAguinaldo), fijos: grupo(detFijos),
    necesario: reponer + suma(detSueldos) + suma(detAguinaldo) + suma(detFijos),
    real: disponible('ARS'),
    pendientes: {
      pedidos: (pend ?? []).length,
      monto: (pend ?? []).reduce((a, p) => a + Number(p.monto_total ?? 0), 0),
      reponer: incluidas.reduce((a, r) => a + r.pendientes * r.costo, 0),
    },
    usd: { fijos: grupo(usdFijos), necesario: suma(usdFijos), disponible: disponible('USD') },
  };
}

// Verde: alcanza con lo real. Amarillo: alcanza si se cobran los pendientes. Rojo: falta.
export function resumenObjetivos(o: Objetivos) {
  const faltaReal = Math.max(o.necesario - o.real, 0);
  const faltaPotencial = Math.max(o.necesario + o.pendientes.reponer - (o.real + o.pendientes.monto), 0);
  // Los dólares no se convierten: si faltan, no alcanza
  const faltaUsd = Math.max(o.usd.necesario - o.usd.disponible, 0);
  const color = faltaUsd > 0 ? 'rojo' as const : faltaReal === 0 ? 'verde' as const : faltaPotencial === 0 ? 'amarillo' as const : 'rojo' as const;
  return { faltaReal, faltaPotencial, faltaUsd, color };
}
