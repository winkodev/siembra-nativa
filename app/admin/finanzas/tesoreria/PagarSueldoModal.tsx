'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { cn, formatPrecio } from '@/lib/utils';
import { Modal, Campo, BotonGuardar } from '@/components/admin/ModalForm';
import { pagarPersonal } from '@/app/actions/personal';
import { etiquetaPeriodo, hoyAR, liquidacion, primerDia, primerSueldo, retirosPendientes, semestreDe, type PersonalVista } from '@/lib/personal';
import type { TesCuenta, TipoPagoPersonal } from '@/lib/types/database';

function Renglon({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn('flex justify-between text-sm', fuerte ? 'text-foreground font-semibold pt-1.5 border-t border-white/10' : 'text-muted-foreground')}>
      <span>{label}</span><span className="tabular-nums">{valor}</span>
    </div>
  );
}

// Pagar sueldo o aguinaldo. El importe viene precargado; admite extra, descuento de retiros y pago parcial.
export function PagarSueldoModal({ personal, cuentas, onClose }: { personal: PersonalVista[]; cuentas: TesCuenta[]; onClose: () => void }) {
  const hoy = hoyAR();
  const [personaId, setPersonaId] = useState(personal[0]?.id ?? '');
  const [tipo, setTipo] = useState<TipoPagoPersonal>('sueldo');
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState('');
  // null = valor sugerido
  const [baseAg, setBaseAg] = useState<string | null>(null);
  const [extraTxt, setExtra] = useState('');
  const [retirosTxt, setRetiros] = useState<string | null>(null);
  const [montoTxt, setMonto] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limpiar = () => { setBaseAg(null); setExtra(''); setRetiros(null); setMonto(null); setError(null); };

  const p = personal.find(x => x.id === personaId);
  const periodo = tipo === 'sueldo' ? primerDia(`${mes}-01`) : semestreDe(`${mes}-01`).periodo;
  const l = p ? liquidacion(p, tipo, periodo) : null;
  const base = tipo === 'aguinaldo' && baseAg != null ? parseFloat(baseAg) || 0 : l?.base ?? 0;
  const extra = parseFloat(extraTxt) || 0;
  const falta = l ? Math.max(base + l.extra + extra - l.retiros - l.pagado, 0) : 0;
  const pendientes = p && tipo === 'sueldo' ? retirosPendientes(p) : 0;
  const retiros = tipo === 'sueldo' ? (retirosTxt != null ? parseFloat(retirosTxt) || 0 : Math.min(pendientes, falta)) : 0;
  const monto = montoTxt != null ? parseFloat(montoTxt) || 0 : Math.round(Math.max(falta - retiros, 0) * 100) / 100;
  const resto = Math.round((falta - retiros - monto) * 100) / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p) return;
    setPending(true); setError(null);
    const res = await pagarPersonal({ personal_id: p.id, nombre: p.nombre, tipo, periodo, base, extra, retiros, monto, cuenta_id: cuentaId, fecha, nota });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal titulo="Pagar sueldo" icono={<Users className="w-5 h-5 text-sky-300" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 p-1 glass-card rounded-lg w-fit">
          {(['sueldo', 'aguinaldo'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTipo(t); limpiar(); }}
              className={cn('px-4 py-1.5 rounded-md text-sm font-semibold transition-all', tipo === t ? 'bg-club-dorado text-club-verde' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'sueldo' ? 'Sueldo' : 'Aguinaldo'}
            </button>
          ))}
        </div>
        <Campo label="Empleado">
          <select value={personaId} onChange={e => { setPersonaId(e.target.value); limpiar(); }} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
            {personal.map(x => <option key={x.id} value={x.id}>{x.nombre}{x.cargo ? ` · ${x.cargo}` : ''}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label={tipo === 'sueldo' ? 'Mes' : 'Semestre'}>
            {tipo === 'sueldo'
              ? <input type="month" value={mes} onChange={e => { if (e.target.value) { setMes(e.target.value); limpiar(); } }} className="input-club w-full" required />
              : (
                <select value={periodo.slice(0, 7)} onChange={e => { setMes(e.target.value); limpiar(); }} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
                  {[0, 1].flatMap(n => { const y = Number(hoy.slice(0, 4)) - n; return [`${y}-12`, `${y}-06`]; })
                    .map(m => <option key={m} value={m}>{etiquetaPeriodo('aguinaldo', `${m}-01`)}</option>)}
                </select>
              )}
          </Campo>
          <Campo label="Sale de">
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>

        {tipo === 'aguinaldo' && (
          <Campo label="Aguinaldo"><input type="number" min="0.01" step="0.01" value={baseAg ?? String(l?.base || '')} onChange={e => { setBaseAg(e.target.value); setMonto(null); }} className="input-club w-full" required /></Campo>
        )}

        {l?.hayPagos && (
          <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {l.falta <= 0 ? 'Este período ya está pagado. Solo podés sumar un extra.' : `Ya hay un pago parcial. Faltan ${formatPrecio(l.falta)}.`}
          </p>
        )}
        {p && tipo === 'sueldo' && l?.base === 0 && <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">{(() => { const s = primerSueldo(p); return s ? `El primer sueldo a pagar es: ${etiquetaPeriodo('sueldo', s.desde)}.` : 'No tiene sueldo cargado.'; })()}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Extra"><input type="number" min="0" step="0.01" value={extraTxt} onChange={e => { setExtra(e.target.value); setMonto(null); }} className="input-club w-full" placeholder="0" /></Campo>
          {pendientes > 0 && (
            <Campo label="Descontar retiros">
              <input type="number" min="0" step="0.01" max={Math.min(pendientes, falta)} value={retirosTxt ?? String(retiros)} onChange={e => { setRetiros(e.target.value); setMonto(null); }} className="input-club w-full" />
            </Campo>
          )}
        </div>

        <div className="rounded-xl border border-club-verde-claro/30 p-3 space-y-1">
          <Renglon label={tipo === 'sueldo' ? 'Sueldo base' : 'Aguinaldo'} valor={formatPrecio(base)} />
          {(l?.extra ?? 0) + extra > 0 && <Renglon label="Extra" valor={`+ ${formatPrecio((l?.extra ?? 0) + extra)}`} />}
          {(l?.pagado ?? 0) + (l?.retiros ?? 0) > 0 && <Renglon label="Ya pagado" valor={`− ${formatPrecio((l?.pagado ?? 0) + (l?.retiros ?? 0))}`} />}
          {retiros > 0 && <Renglon label="Retiros de flores" valor={`− ${formatPrecio(retiros)}`} />}
          <Renglon label="A pagar" valor={formatPrecio(Math.max(falta - retiros, 0))} fuerte />
          {pendientes > retiros && <p className="text-[11px] text-amber-300">Quedan {formatPrecio(pendientes - retiros)} de retiros para el próximo sueldo.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Se paga ahora"><input type="number" min="0" step="0.01" value={montoTxt ?? String(monto)} onChange={e => setMonto(e.target.value)} className="input-club w-full text-lg font-bold" required /></Campo>
          <Campo label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-club w-full" required /></Campo>
        </div>
        {resto > 0 && monto + retiros > 0 && <p className="text-xs text-muted-foreground">Pago parcial: quedan {formatPrecio(resto)} por pagar.</p>}
        <Campo label="Nota"><input value={nota} onChange={e => setNota(e.target.value)} className="input-club w-full" placeholder="Opcional" /></Campo>

        {error && <p className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancelar</button>
          <BotonGuardar pending={pending || !p || monto + retiros <= 0 || resto < 0} label={`Pagar ${formatPrecio(monto)}`} />
        </div>
      </form>
    </Modal>
  );
}
