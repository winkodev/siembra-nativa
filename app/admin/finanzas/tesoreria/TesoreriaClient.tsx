'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Landmark, Plus, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Repeat, HandCoins,
  Loader2, X, Trash2, Download, AlertTriangle, Pencil, Check, Tag, ChevronDown, Ban,
} from 'lucide-react';
import { cn, formatFecha } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { FinanzasTabs } from '../FinanzasTabs';
import {
  crearCuenta, editarCuenta, crearMovimiento, crearTransferencia, crearCambio, eliminarMovimiento,
  crearDeuda, anularDeuda, crearCategoria, toggleCategoria, guardarCuentaCobros,
} from '@/app/actions/tesoreria';
import type { TesCuenta, TesCategoria, TesSaldo, TesDeuda, TesMovimiento, Moneda, TipoMovimiento } from '@/lib/types/database';

// Movimiento con nombres resueltos (lo arma la page)
export type MovimientoVista = TesMovimiento & {
  cuenta_nombre: string; destino_nombre: string | null; categoria_nombre: string | null;
  deuda_acreedor: string | null; autor_nombre: string | null;
};
// Deuda con lo pagado y el saldo pendiente
export type DeudaVista = TesDeuda & { pagado: number; saldo: number };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

// Formato por moneda: $ 1.234 (ARS) · US$ 1.234,50 (USD)
function fmt(moneda: Moneda, monto: number): string {
  return moneda === 'USD'
    ? `US$ ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$ ${monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}
function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TIPO_LABEL: Record<TipoMovimiento, string> = {
  inicial: 'Saldo inicial', ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia', cambio: 'Cambio',
};
const TIPO_COLOR: Record<TipoMovimiento, string> = {
  inicial:       'text-sky-300 bg-sky-400/10 border-sky-400/30',
  ingreso:       'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  egreso:        'text-red-400 bg-red-400/10 border-red-400/30',
  transferencia: 'text-muted-foreground bg-white/5 border-white/15',
  cambio:        'text-club-dorado bg-club-dorado/10 border-club-dorado/30',
};

// Exportar a CSV (separador ; para Excel en español)
function descargarCSV(nombre: string, filas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const url = URL.createObjectURL(new Blob(['﻿' + filas.map(f => f.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url);
}

// Modal genérico
function Modal({ titulo, icono, onClose, children }: { titulo: string; icono: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">{icono} {titulo}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-foreground/70 font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function SelectorMoneda({ value, onChange }: { value: Moneda; onChange: (m: Moneda) => void }) {
  return (
    <div className="flex gap-1 p-1 glass-card rounded-lg w-fit">
      {(['ARS', 'USD'] as Moneda[]).map(m => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={cn('px-4 py-1.5 rounded-md text-sm font-semibold transition-all',
            value === m ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
          {m === 'ARS' ? 'Pesos' : 'Dólares'}
        </button>
      ))}
    </div>
  );
}

function BotonGuardar({ pending, label, color = 'btn-primary' }: { pending: boolean; label: string; color?: string }) {
  return (
    <button type="submit" disabled={pending} className={cn(color, 'flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl font-semibold')}>
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
    </button>
  );
}

interface Props {
  cuentas:      TesCuenta[];
  saldos:       TesSaldo[];
  categorias:   TesCategoria[];
  deudas:       DeudaVista[];
  movimientos:  MovimientoVista[];
  cuentaCobros: string;
  desde:        string;
  hasta:        string;
  errorMsg:     string | null;
}

type ModalTipo =
  | { k: 'cuenta'; cuenta?: TesCuenta }
  | { k: 'mov'; tipo: 'ingreso' | 'egreso'; deuda?: DeudaVista }
  | { k: 'transferencia' }
  | { k: 'cambio' }
  | { k: 'deuda' }
  | { k: 'eliminar'; mov: MovimientoVista }
  | null;

export function TesoreriaClient({ cuentas, saldos, categorias, deudas, movimientos, cuentaCobros, desde: desdeInicial, hasta: hastaInicial, errorMsg }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalTipo>(null);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [mostrarCategorias, setMostrarCategorias] = useState(false);

  // Filtros del listado
  const [fTipo, setFTipo]     = useState<'todos' | TipoMovimiento>('todos');
  const [fCuenta, setFCuenta] = useState('todas');
  const [fMoneda, setFMoneda] = useState<'todas' | Moneda>('todas');
  const [fTexto, setFTexto]   = useState('');

  const cuentasActivas = cuentas.filter(c => c.activa);
  const saldoDe = (cuentaId: string, moneda: Moneda) => saldos.find(s => s.cuenta_id === cuentaId && s.moneda === moneda)?.saldo ?? 0;
  const totalARS = saldos.filter(s => s.moneda === 'ARS').reduce((a, s) => a + s.saldo, 0);
  const totalUSD = saldos.filter(s => s.moneda === 'USD').reduce((a, s) => a + s.saldo, 0);
  const deudasVivas = deudas.filter(d => !d.anulada && d.saldo > 0);
  const sumaDeudas = (sentido: 'a_pagar' | 'a_cobrar', moneda: Moneda) =>
    deudasVivas.filter(d => d.sentido === sentido && d.moneda === moneda).reduce((a, d) => a + d.saldo, 0);

  // Flujo del período: entradas y salidas reales por moneda (transferencias no cuentan)
  const flujo = useMemo(() => {
    const f = { ARS: { entra: 0, sale: 0 }, USD: { entra: 0, sale: 0 } };
    for (const m of movimientos) {
      if (m.tipo === 'ingreso' || m.tipo === 'inicial') f[m.moneda].entra += m.monto;
      else if (m.tipo === 'egreso') f[m.moneda].sale += m.monto;
      else if (m.tipo === 'cambio' && m.moneda_destino && m.monto_destino != null) {
        f[m.moneda].sale += m.monto;
        f[m.moneda_destino].entra += m.monto_destino;
      }
    }
    return f;
  }, [movimientos]);

  const filtrados = useMemo(() => {
    const q = fTexto.trim().toLowerCase();
    return movimientos.filter(m => {
      if (fTipo !== 'todos' && m.tipo !== fTipo) return false;
      if (fCuenta !== 'todas' && m.cuenta_id !== fCuenta && m.cuenta_destino_id !== fCuenta) return false;
      if (fMoneda !== 'todas' && m.moneda !== fMoneda && m.moneda_destino !== fMoneda) return false;
      if (!q) return true;
      return m.concepto.toLowerCase().includes(q) || (m.nota ?? '').toLowerCase().includes(q)
        || (m.categoria_nombre ?? '').toLowerCase().includes(q) || (m.deuda_acreedor ?? '').toLowerCase().includes(q);
    });
  }, [movimientos, fTipo, fCuenta, fMoneda, fTexto]);

  const aplicarRango = () => startTransition(() => router.push(`/admin/finanzas/tesoreria?desde=${desde}&hasta=${hasta}`));
  const cerrarYRefrescar = () => { setModal(null); router.refresh(); };

  const handleCuentaCobros = (id: string) => startTransition(async () => {
    const res = await guardarCuentaCobros(id);
    if (!res.ok) setError(res.error);
    router.refresh();
  });

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader icon={<Wallet className="w-5 h-5" />} title="Finanzas" subtitle="Tesorería: cuánta plata tiene el club, dónde está y a quién le debe · solo superadmin" />
      <FinanzasTabs />

      {errorMsg && (
        <motion.div variants={fadeUp} className="glass-card p-5 flex items-center gap-3 text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" /> <p className="text-sm">{errorMsg}</p>
        </motion.div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          {error} <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={fadeUp} className="glass-card p-4">
          <p className="text-muted-foreground text-xs mb-1">Total en pesos</p>
          <p className="text-foreground font-bold text-2xl">{fmt('ARS', totalARS)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Período: <span className="text-emerald-400">+{fmt('ARS', flujo.ARS.entra)}</span> · <span className="text-red-400">−{fmt('ARS', flujo.ARS.sale)}</span></p>
        </motion.div>
        <motion.div variants={fadeUp} className="glass-card p-4">
          <p className="text-muted-foreground text-xs mb-1">Total en dólares</p>
          <p className="text-foreground font-bold text-2xl">{fmt('USD', totalUSD)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Período: <span className="text-emerald-400">+{fmt('USD', flujo.USD.entra)}</span> · <span className="text-red-400">−{fmt('USD', flujo.USD.sale)}</span></p>
        </motion.div>
        <motion.div variants={fadeUp} className="glass-card p-4">
          <p className="text-muted-foreground text-xs mb-1">El club debe</p>
          <p className={cn('font-bold text-xl', sumaDeudas('a_pagar', 'ARS') > 0 ? 'text-red-400' : 'text-foreground')}>{fmt('ARS', sumaDeudas('a_pagar', 'ARS'))}</p>
          <p className={cn('font-bold text-base', sumaDeudas('a_pagar', 'USD') > 0 ? 'text-red-400' : 'text-foreground')}>{fmt('USD', sumaDeudas('a_pagar', 'USD'))}</p>
        </motion.div>
        <motion.div variants={fadeUp} className="glass-card p-4">
          <p className="text-muted-foreground text-xs mb-1">Le deben al club</p>
          <p className={cn('font-bold text-xl', sumaDeudas('a_cobrar', 'ARS') > 0 ? 'text-emerald-400' : 'text-foreground')}>{fmt('ARS', sumaDeudas('a_cobrar', 'ARS'))}</p>
          <p className={cn('font-bold text-base', sumaDeudas('a_cobrar', 'USD') > 0 ? 'text-emerald-400' : 'text-foreground')}>{fmt('USD', sumaDeudas('a_cobrar', 'USD'))}</p>
        </motion.div>
      </div>

      {/* Acciones */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        <button onClick={() => setModal({ k: 'mov', tipo: 'ingreso' })} disabled={cuentasActivas.length === 0} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors flex items-center gap-2 disabled:opacity-40">
          <ArrowDownCircle className="w-4 h-4" /> Ingreso
        </button>
        <button onClick={() => setModal({ k: 'mov', tipo: 'egreso' })} disabled={cuentasActivas.length === 0} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors flex items-center gap-2 disabled:opacity-40">
          <ArrowUpCircle className="w-4 h-4" /> Egreso
        </button>
        <button onClick={() => setModal({ k: 'transferencia' })} disabled={cuentasActivas.length < 2} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-foreground hover:border-club-dorado/40 transition-colors flex items-center gap-2 disabled:opacity-40">
          <ArrowRightLeft className="w-4 h-4" /> Transferencia
        </button>
        <button onClick={() => setModal({ k: 'cambio' })} disabled={cuentasActivas.length === 0} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-club-dorado/15 border border-club-dorado/30 text-club-dorado hover:bg-club-dorado/25 transition-colors flex items-center gap-2 disabled:opacity-40">
          <Repeat className="w-4 h-4" /> Cambio de moneda
        </button>
        <button onClick={() => setModal({ k: 'deuda' })} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors flex items-center gap-2">
          <HandCoins className="w-4 h-4" /> Nueva deuda
        </button>
        <button onClick={() => setModal({ k: 'cuenta' })} className="ml-auto btn-primary text-sm px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </button>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cuentas */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
          <h3 className="font-avigea text-base text-foreground flex items-center gap-2"><Landmark className="w-4 h-4 text-club-dorado" /> Cuentas · dónde está la plata</h3>
          {cuentas.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              Todavía no hay cuentas. Creá la primera con su saldo inicial en pesos y dólares: ese es el blanqueo desde el que arranca todo.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
                  <th className="text-left py-2 font-semibold">Cuenta</th>
                  <th className="text-right py-2 font-semibold">Pesos</th>
                  <th className="text-right py-2 font-semibold">Dólares</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-club-verde-claro/10">
                {cuentas.map(c => (
                  <tr key={c.id} className={cn(!c.activa && 'opacity-50')}>
                    <td className="py-2.5">
                      <p className="text-foreground font-medium">{c.nombre}{!c.activa && <span className="ml-2 text-[10px] text-muted-foreground">archivada</span>}</p>
                      {c.descripcion && <p className="text-muted-foreground text-xs">{c.descripcion}</p>}
                    </td>
                    <td className="py-2.5 text-right text-foreground tabular-nums">{fmt('ARS', saldoDe(c.id, 'ARS'))}</td>
                    <td className="py-2.5 text-right text-foreground tabular-nums">{fmt('USD', saldoDe(c.id, 'USD'))}</td>
                    <td className="py-2.5 text-right">
                      <button onClick={() => setModal({ k: 'cuenta', cuenta: c })} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-club-verde-claro/30">
                  <td className="py-2.5 text-foreground font-semibold">Total</td>
                  <td className="py-2.5 text-right text-club-dorado font-bold tabular-nums">{fmt('ARS', totalARS)}</td>
                  <td className="py-2.5 text-right text-club-dorado font-bold tabular-nums">{fmt('USD', totalUSD)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}

          {/* Cuenta de cobros */}
          <div className="pt-3 border-t border-club-verde-claro/20 space-y-1.5">
            <p className="text-xs text-foreground/80 font-medium">Cuenta donde entran los cobros de pedidos</p>
            <select value={cuentaCobros} onChange={e => handleCuentaCobros(e.target.value)} disabled={pending}
              className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer py-2 text-sm">
              <option value="">No registrar automáticamente</option>
              {cuentasActivas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <p className="text-muted-foreground text-[11px]">
              Al aprobar un pedido, su total entra como ingreso en esta cuenta. Si se cancela o se revierte, el ingreso se elimina.
            </p>
          </div>
        </motion.div>

        {/* Deudas */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
          <h3 className="font-avigea text-base text-foreground flex items-center gap-2"><HandCoins className="w-4 h-4 text-amber-300" /> Deudas</h3>
          {deudas.filter(d => !d.anulada).length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Sin deudas registradas.</p>
          ) : (
            <div className="divide-y divide-club-verde-claro/10">
              {deudas.filter(d => !d.anulada).map(d => {
                const vencida = d.vence_at && d.saldo > 0 && d.vence_at < hoyISO();
                const aCobrar = d.sentido === 'a_cobrar';
                return (
                  <div key={d.id} className={cn('py-2.5 flex items-center gap-3 border-l-2 pl-3', aCobrar ? 'border-emerald-400/60' : 'border-red-400/60')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium text-sm truncate">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border mr-1.5', aCobrar ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10')}>
                          {aCobrar ? 'Nos debe' : 'Debemos'}
                        </span>
                        {d.acreedor}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {fmt(d.moneda, d.monto)} total · pagado {fmt(d.moneda, d.pagado)}
                        {d.vence_at && <> · <span className={cn(vencida && 'text-red-400 font-semibold')}>vence {formatFecha(d.vence_at)}</span></>}
                        {d.nota && <> · {d.nota}</>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('font-bold tabular-nums', d.saldo > 0 ? (aCobrar ? 'text-emerald-400' : 'text-red-400') : 'text-muted-foreground')}>
                        {d.saldo > 0 ? fmt(d.moneda, d.saldo) : 'Saldada'}
                      </p>
                      <div className="flex gap-2 justify-end mt-0.5">
                        {d.saldo > 0 && (
                          <button onClick={() => setModal({ k: 'mov', tipo: aCobrar ? 'ingreso' : 'egreso', deuda: d })} className="text-[11px] text-club-dorado hover:text-club-dorado/80">
                            {aCobrar ? 'Cobrar' : 'Pagar'}
                          </button>
                        )}
                        {d.pagado === 0 && (
                          <button onClick={() => startTransition(async () => { const r = await anularDeuda(d.id); if (!r.ok) setError(r.error); router.refresh(); })}
                            className="text-[11px] text-red-400/70 hover:text-red-400 inline-flex items-center gap-0.5"><Ban className="w-3 h-3" /> Anular</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Movimientos */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-avigea text-base text-foreground">Movimientos</h3>
          <span className="text-muted-foreground text-xs">{filtrados.length} de {movimientos.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="input-club py-1.5 text-xs" />
            <span className="text-muted-foreground text-xs">a</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="input-club py-1.5 text-xs" />
            <button onClick={aplicarRango} disabled={pending} className="px-3 py-1.5 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-xs font-semibold disabled:opacity-50">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
            </button>
            <button onClick={() => descargarCSV(`tesoreria-${desde}-${hasta}.csv`, [
              ['Fecha', 'Tipo', 'Cuenta', 'Moneda', 'Monto', 'Cuenta destino', 'Moneda destino', 'Monto destino', 'Tipo de cambio', 'Categoría', 'Deuda', 'Concepto', 'Nota', 'Cargado por'],
              ...filtrados.map(m => [m.fecha, TIPO_LABEL[m.tipo], m.cuenta_nombre, m.moneda, m.monto, m.destino_nombre ?? '', m.moneda_destino ?? '', m.monto_destino ?? '', m.tipo_cambio ?? '', m.categoria_nombre ?? '', m.deuda_acreedor ?? '', m.concepto, m.nota ?? '', m.autor_nombre ?? '']),
            ])} className="text-xs text-club-dorado hover:text-club-dorado/80 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> CSV</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={fTipo} onChange={e => setFTipo(e.target.value as typeof fTipo)} className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs">
            <option value="todos">Todos los tipos</option>
            {(Object.keys(TIPO_LABEL) as TipoMovimiento[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
          <select value={fCuenta} onChange={e => setFCuenta(e.target.value)} className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs">
            <option value="todas">Todas las cuentas</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={fMoneda} onChange={e => setFMoneda(e.target.value as typeof fMoneda)} className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-xs">
            <option value="todas">Pesos y dólares</option>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
          <input value={fTexto} onChange={e => setFTexto(e.target.value)} placeholder="Buscar concepto, nota, categoría…" className="input-club py-2 text-xs flex-1 min-w-[180px]" />
        </div>

        {filtrados.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Sin movimientos con esos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-club-verde-claro/20">
                  <th className="text-left py-2 font-semibold">Fecha</th>
                  <th className="text-left py-2 font-semibold">Tipo</th>
                  <th className="text-left py-2 font-semibold">Concepto</th>
                  <th className="text-left py-2 font-semibold">Cuenta</th>
                  <th className="text-right py-2 font-semibold">Monto</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-club-verde-claro/10">
                {filtrados.map(m => {
                  const sale = m.tipo === 'egreso' || m.tipo === 'transferencia' || m.tipo === 'cambio';
                  return (
                    <tr key={m.id}>
                      <td className="py-2 text-muted-foreground whitespace-nowrap">{formatFecha(m.fecha, 'dd MMM yy')}</td>
                      <td className="py-2"><span className={cn('px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap', TIPO_COLOR[m.tipo])}>{TIPO_LABEL[m.tipo]}</span></td>
                      <td className="py-2 max-w-[280px]">
                        <p className="text-foreground truncate">{m.concepto}</p>
                        <p className="text-muted-foreground text-xs truncate">
                          {[m.categoria_nombre, m.deuda_acreedor ? `deuda: ${m.deuda_acreedor}` : null, m.nota].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {m.cuenta_nombre}{m.destino_nombre && <> → {m.destino_nombre}</>}
                      </td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap">
                        <span className={cn('font-semibold', m.tipo === 'ingreso' || m.tipo === 'inicial' ? 'text-emerald-400' : m.tipo === 'egreso' ? 'text-red-400' : 'text-foreground')}>
                          {m.tipo === 'ingreso' || m.tipo === 'inicial' ? '+' : sale && m.tipo === 'egreso' ? '−' : ''}{fmt(m.moneda, m.monto)}
                        </span>
                        {m.tipo === 'cambio' && m.moneda_destino && m.monto_destino != null && (
                          <span className="block text-xs text-club-dorado">→ {fmt(m.moneda_destino, m.monto_destino)}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => setModal({ k: 'eliminar', mov: m })} title="Eliminar movimiento" className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Categorías */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
        <button onClick={() => setMostrarCategorias(v => !v)} className="w-full flex items-center justify-between text-left">
          <h3 className="font-avigea text-base text-foreground flex items-center gap-2"><Tag className="w-4 h-4 text-club-dorado" /> Categorías</h3>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', mostrarCategorias && 'rotate-180')} />
        </button>
        {mostrarCategorias && <Categorias categorias={categorias} onCambio={() => router.refresh()} onError={setError} />}
      </motion.div>

      {/* Modales */}
      <AnimatePresence>
        {modal?.k === 'cuenta' && <CuentaModal cuenta={modal.cuenta} onClose={cerrarYRefrescar} />}
        {modal?.k === 'mov' && <MovimientoModal tipo={modal.tipo} deuda={modal.deuda} cuentas={cuentasActivas} categorias={categorias.filter(c => c.activa && c.tipo === modal.tipo)} deudas={deudasVivas} onClose={cerrarYRefrescar} />}
        {modal?.k === 'transferencia' && <TransferenciaModal cuentas={cuentasActivas} onClose={cerrarYRefrescar} />}
        {modal?.k === 'cambio' && <CambioModal cuentas={cuentasActivas} onClose={cerrarYRefrescar} />}
        {modal?.k === 'deuda' && <DeudaModal onClose={cerrarYRefrescar} />}
        {modal?.k === 'eliminar' && (
          <Modal titulo="Eliminar movimiento" icono={<Trash2 className="w-5 h-5 text-red-400" />} onClose={() => setModal(null)}>
            <p className="text-sm text-foreground">{modal.mov.concepto}</p>
            <p className="text-xs text-muted-foreground">{TIPO_LABEL[modal.mov.tipo]} · {fmt(modal.mov.moneda, modal.mov.monto)} · {formatFecha(modal.mov.fecha)}</p>
            <p className="text-xs text-muted-foreground">Se borra y los saldos se recalculan. Queda registrado en auditoría.</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button disabled={pending} onClick={() => startTransition(async () => { const r = await eliminarMovimiento(modal.mov.id); if (!r.ok) setError(r.error); cerrarYRefrescar(); })}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Eliminar'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Modales ──────────────────────────────────────────────────

function CuentaModal({ cuenta, onClose }: { cuenta?: TesCuenta; onClose: () => void }) {
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(cuenta?.descripcion ?? '');
  const [activa, setActiva] = useState(cuenta?.activa ?? true);
  const [ars, setArs] = useState('');
  const [usd, setUsd] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = cuenta
      ? await editarCuenta(cuenta.id, { nombre, descripcion, activa })
      : await crearCuenta({ nombre, descripcion, saldoARS: parseFloat(ars) || 0, saldoUSD: parseFloat(usd) || 0 });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo={cuenta ? 'Editar cuenta' : 'Nueva cuenta'} icono={<Landmark className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Campo label="Nombre *"><input value={nombre} onChange={e => setNombre(e.target.value)} className="input-club w-full" placeholder="Caja del club, Banco, Mercado Pago…" required /></Campo>
        <Campo label="Descripción"><input value={descripcion} onChange={e => setDescripcion(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        {!cuenta ? (
          <>
            <p className="text-xs text-muted-foreground">Saldo inicial (blanqueo): con cuánto arranca esta cuenta hoy. Después todo se mueve con ingresos y egresos.</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Pesos"><input type="number" min="0" step="0.01" value={ars} onChange={e => setArs(e.target.value)} className="input-club w-full" placeholder="0" /></Campo>
              <Campo label="Dólares"><input type="number" min="0" step="0.01" value={usd} onChange={e => setUsd(e.target.value)} className="input-club w-full" placeholder="0" /></Campo>
            </div>
          </>
        ) : (
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} /> Cuenta activa (desmarcá para archivarla; conserva su historial)
          </label>
        )}
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending} label={cuenta ? 'Guardar' : 'Crear cuenta'} />
        </div>
      </form>
    </Modal>
  );
}

function MovimientoModal({ tipo, deuda, cuentas, categorias, deudas, onClose }: {
  tipo: 'ingreso' | 'egreso'; deuda?: DeudaVista; cuentas: TesCuenta[]; categorias: TesCategoria[]; deudas: DeudaVista[]; onClose: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [moneda, setMoneda] = useState<Moneda>(deuda?.moneda ?? 'ARS');
  const [monto, setMonto] = useState(deuda ? String(deuda.saldo) : '');
  const [categoriaId, setCategoriaId] = useState(deuda ? (categorias.find(c => c.nombre === (tipo === 'egreso' ? 'Pago de deudas' : 'Otros ingresos'))?.id ?? '') : '');
  const [deudaId, setDeudaId] = useState(deuda?.id ?? '');
  const [concepto, setConcepto] = useState(deuda ? (tipo === 'egreso' ? `Pago a ${deuda.acreedor}` : `Cobro a ${deuda.acreedor}`) : '');
  const [nota, setNota] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esEgreso = tipo === 'egreso';
  // Egreso paga deudas del club; ingreso cobra deudas a favor
  const deudasAplicables = deudas.filter(d => d.sentido === (esEgreso ? 'a_pagar' : 'a_cobrar'));
  const deudaSel = deudasAplicables.find(d => d.id === deudaId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = await crearMovimiento({
      tipo, fecha, cuenta_id: cuentaId, moneda: deudaSel ? deudaSel.moneda : moneda, monto: parseFloat(monto),
      categoria_id: categoriaId || null, deuda_id: deudaId || null, concepto, nota,
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo={esEgreso ? 'Registrar egreso' : 'Registrar ingreso'}
      icono={esEgreso ? <ArrowUpCircle className="w-5 h-5 text-red-400" /> : <ArrowDownCircle className="w-5 h-5 text-emerald-400" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-club w-full" /></Campo>
          <Campo label={esEgreso ? 'Sale de' : 'Entra a'}>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        {deudasAplicables.length > 0 && (
          <Campo label={esEgreso ? 'Paga una deuda del club' : 'Cobra una deuda a favor'}>
            <select value={deudaId} onChange={e => { setDeudaId(e.target.value); const d = deudasAplicables.find(x => x.id === e.target.value); if (d) { setMoneda(d.moneda); setMonto(String(d.saldo)); if (!concepto) setConcepto(`${esEgreso ? 'Pago a' : 'Cobro a'} ${d.acreedor}`); } }}
              className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              <option value="">No</option>
              {deudasAplicables.map(d => <option key={d.id} value={d.id}>{d.acreedor} · {esEgreso ? 'debemos' : 'nos debe'} {fmt(d.moneda, d.saldo)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Moneda">
          {deudaSel ? <p className="text-sm text-foreground">{deudaSel.moneda === 'ARS' ? 'Pesos' : 'Dólares'} (la de la deuda)</p> : <SelectorMoneda value={moneda} onChange={setMoneda} />}
        </Campo>
        <Campo label="Monto *">
          <input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input-club w-full text-lg font-bold" required />
          {deudaSel && parseFloat(monto) > deudaSel.saldo && <p className="text-amber-300 text-xs mt-1">Es más que el saldo de la deuda ({fmt(deudaSel.moneda, deudaSel.saldo)}).</p>}
        </Campo>
        <Campo label="Concepto *"><input value={concepto} onChange={e => setConcepto(e.target.value)} className="input-club w-full" placeholder={esEgreso ? 'Ej: compra de sustrato' : 'Ej: cuota social de octubre'} required /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Categoría">
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        </div>
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending} label={esEgreso ? 'Registrar egreso' : 'Registrar ingreso'} />
        </div>
      </form>
    </Modal>
  );
}

function TransferenciaModal({ cuentas, onClose }: { cuentas: TesCuenta[]; onClose: () => void }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [origen, setOrigen] = useState(cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState(cuentas[1]?.id ?? '');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = await crearTransferencia({ fecha, cuenta_id: origen, cuenta_destino_id: destino, moneda, monto: parseFloat(monto), nota });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo="Transferencia entre cuentas" icono={<ArrowRightLeft className="w-5 h-5 text-foreground" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Campo label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-club w-full" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="De">
            <select value={origen} onChange={e => setOrigen(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="A">
            <select value={destino} onChange={e => setDestino(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Moneda"><SelectorMoneda value={moneda} onChange={setMoneda} /></Campo>
        <Campo label="Monto *"><input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input-club w-full text-lg font-bold" required /></Campo>
        <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending} label="Transferir" />
        </div>
      </form>
    </Modal>
  );
}

function CambioModal({ cuentas, onClose }: { cuentas: TesCuenta[]; onClose: () => void }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [operacion, setOperacion] = useState<'compra' | 'venta'>('compra');  // compra = pesos → dólares
  const [origen, setOrigen] = useState(cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState(cuentas[0]?.id ?? '');
  const [pesos, setPesos] = useState('');
  const [dolares, setDolares] = useState('');
  const [nota, setNota] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = parseFloat(pesos) || 0, d = parseFloat(dolares) || 0;
  const tc = p > 0 && d > 0 ? p / d : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = operacion === 'compra'
      ? await crearCambio({ fecha, cuenta_id: origen, moneda: 'ARS', monto: p, cuenta_destino_id: destino, monto_destino: d, nota })
      : await crearCambio({ fecha, cuenta_id: origen, moneda: 'USD', monto: d, cuenta_destino_id: destino, monto_destino: p, nota });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo="Cambio de moneda" icono={<Repeat className="w-5 h-5 text-club-dorado" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 p-1 glass-card rounded-lg w-fit">
          {(['compra', 'venta'] as const).map(op => (
            <button key={op} type="button" onClick={() => setOperacion(op)}
              className={cn('px-4 py-1.5 rounded-md text-sm font-semibold transition-all', operacion === op ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
              {op === 'compra' ? 'Comprar dólares' : 'Vender dólares'}
            </button>
          ))}
        </div>
        <Campo label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-club w-full" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label={operacion === 'compra' ? 'Salen los pesos de' : 'Salen los dólares de'}>
            <select value={origen} onChange={e => setOrigen(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label={operacion === 'compra' ? 'Entran los dólares a' : 'Entran los pesos a'}>
            <select value={destino} onChange={e => setDestino(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Pesos *"><input type="number" min="0.01" step="0.01" value={pesos} onChange={e => setPesos(e.target.value)} className="input-club w-full text-lg font-bold" required /></Campo>
          <Campo label="Dólares *"><input type="number" min="0.01" step="0.01" value={dolares} onChange={e => setDolares(e.target.value)} className="input-club w-full text-lg font-bold" required /></Campo>
        </div>
        <p className="text-xs text-muted-foreground">Tipo de cambio: {tc > 0 ? `$ ${tc.toLocaleString('es-AR', { maximumFractionDigits: 2 })} por dólar` : '—'}. Puede ser la misma cuenta en los dos lados.</p>
        <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending} label="Registrar cambio" />
        </div>
      </form>
    </Modal>
  );
}

function DeudaModal({ onClose }: { onClose: () => void }) {
  const [acreedor, setAcreedor] = useState('');
  const [sentido, setSentido] = useState<'a_pagar' | 'a_cobrar'>('a_pagar');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [monto, setMonto] = useState('');
  const [vence, setVence] = useState('');
  const [nota, setNota] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    const res = await crearDeuda({ acreedor, sentido, moneda, monto: parseFloat(monto), vence_at: vence || null, nota });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo="Nueva deuda" icono={<HandCoins className="w-5 h-5 text-amber-300" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {([['a_pagar', 'El club debe', 'red'], ['a_cobrar', 'Le deben al club', 'emerald']] as const).map(([v, l, c]) => (
            <button key={v} type="button" onClick={() => setSentido(v)}
              className={cn('px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                sentido === v
                  ? (c === 'red' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400')
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground')}>
              {l}
            </button>
          ))}
        </div>
        <Campo label={sentido === 'a_pagar' ? 'A quién le debe el club *' : 'Quién le debe al club *'}><input value={acreedor} onChange={e => setAcreedor(e.target.value)} className="input-club w-full" placeholder="Proveedor, persona, banco…" required /></Campo>
        <Campo label="Moneda"><SelectorMoneda value={moneda} onChange={setMoneda} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Monto *"><input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input-club w-full text-lg font-bold" required /></Campo>
          <Campo label="Vence"><input type="date" value={vence} onChange={e => setVence(e.target.value)} className="input-club w-full" /></Campo>
        </div>
        <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>
        <p className="text-xs text-muted-foreground">
          {sentido === 'a_pagar'
            ? 'Se paga registrando egresos asignados a esta deuda; el saldo se descuenta solo.'
            : 'Se cobra registrando ingresos asignados a esta deuda; el saldo se descuenta solo.'}
        </p>
        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending} label="Registrar deuda" />
        </div>
      </form>
    </Modal>
  );
}

function Categorias({ categorias, onCambio, onError }: { categorias: TesCategoria[]; onCambio: () => void; onError: (e: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [pending, startTransition] = useTransition();

  const agregar = () => startTransition(async () => {
    const r = await crearCategoria(nombre, tipo);
    if (!r.ok) { onError(r.error); return; }
    setNombre(''); onCambio();
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nueva categoría" className="input-club py-2 text-sm flex-1 min-w-[160px]" />
        <select value={tipo} onChange={e => setTipo(e.target.value as 'ingreso' | 'egreso')} className="input-club bg-club-verde-medio appearance-none cursor-pointer py-2 text-sm">
          <option value="egreso">Egreso</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <button onClick={agregar} disabled={pending || !nombre.trim()} className="px-4 py-2 rounded-lg bg-club-dorado/15 border border-club-dorado/30 text-club-dorado text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        {(['ingreso', 'egreso'] as const).map(t => (
          <div key={t}>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t === 'ingreso' ? 'Ingresos' : 'Egresos'}</p>
            {categorias.filter(c => c.tipo === t).map(c => (
              <button key={c.id} onClick={() => startTransition(async () => { const r = await toggleCategoria(c.id, !c.activa); if (!r.ok) onError(r.error); onCambio(); })}
                className={cn('w-full flex items-center justify-between py-1.5 text-sm text-left', !c.activa && 'opacity-40 line-through')}>
                <span className="text-foreground">{c.nombre}</span>
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center', c.activa ? 'bg-club-dorado border-club-dorado' : 'border-white/25')}>
                  {c.activa && <Check className="w-3 h-3 text-club-verde" />}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
