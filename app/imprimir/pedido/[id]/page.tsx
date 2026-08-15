import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { registrarAccion } from '@/lib/audit';
import { formatFecha, formatGramos, formatNumeroPedido, labelTipo, labelCategoriaProducto } from '@/lib/utils';
import { PrintControls } from './PrintControls';
import type { EstadoPedido } from '@/lib/types/database';

export const metadata = { title: 'Imprimir pedido' };

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

interface Props {
  params: { id: string };
}

// Vista imprimible del pedido (hoja blanca): el navegador la manda
// a la impresora o la guarda como PDF desde el diálogo de impresión.
export default async function ImprimirPedidoPage({ params }: Props) {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      *,
      pedido_items (
        *,
        geneticas ( nombre, tipo ),
        productos ( nombre, categoria )
      ),
      profiles!socio_id ( nombre, dni, telefono, email, direccion, localidad, provincia, codigo_postal, reprocann_numero )
    `)
    .eq('id', params.id)
    .single();

  if (!pedido) notFound();

  const p = pedido as any;
  const socio = p.profiles;
  const items = p.pedido_items as any[];
  const totalGramos   = items.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);
  const totalUnidades = items.reduce((s, i) => s + (i.cantidad_unidades ?? 0), 0);
  const direccion = [socio?.direccion, socio?.localidad, socio?.provincia, socio?.codigo_postal]
    .filter(Boolean).join(', ') || '—';

  // La orden contiene datos personales: se registra el acceso
  await registrarAccion(supabase, 'imprimir_pedido', 'pedidos', { pedido_id: p.id }, p.socio_id);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PrintControls />

      <div className="max-w-[180mm] mx-auto px-8 py-8 print:px-0 print:py-0 text-[13px]">

        {/* Encabezado */}
        <header className="flex items-start justify-between border-b-2 border-neutral-900 pb-3 mb-5">
          <div>
            <p className="font-avigea text-2xl leading-none">Siembra Nativa Club</p>
            <p className="text-neutral-500 text-xs mt-1">Orden de pedido</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-base tracking-wider">Orden {formatNumeroPedido(p.numero)}</p>
            <p className="text-neutral-500">Fecha: {formatFecha(p.created_at, "dd 'de' MMMM 'de' yyyy")}</p>
            <p className="text-neutral-500">Estado: <span className="font-semibold text-neutral-900">{ESTADO_LABEL[p.estado as EstadoPedido]}</span></p>
          </div>
        </header>

        {/* Datos del socio */}
        <section className="mb-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Datos del socio</h2>
          <div className="border border-neutral-300 rounded-lg p-3 grid grid-cols-2 gap-x-6 gap-y-1">
            <p><span className="text-neutral-500">Nombre:</span> <span className="font-semibold">{socio?.nombre ?? '—'}</span></p>
            <p><span className="text-neutral-500">DNI:</span> {socio?.dni ?? '—'}</p>
            <p><span className="text-neutral-500">Teléfono:</span> {socio?.telefono ?? '—'}</p>
            <p><span className="text-neutral-500">Email:</span> {socio?.email ?? '—'}</p>
            <p className="col-span-2"><span className="text-neutral-500">Dirección:</span> {direccion}</p>
            <p className="col-span-2"><span className="text-neutral-500">REPROCANN:</span> {socio?.reprocann_numero ?? '—'}</p>
          </div>
        </section>

        {/* Entrega */}
        <section className="mb-5 grid grid-cols-2 gap-3">
          <div className="border border-neutral-300 rounded-lg p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">Horario de entrega</p>
            <p className="font-semibold">{p.entrega_franja ?? 'Sin especificar'}</p>
          </div>
          <div className="border border-neutral-300 rounded-lg p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">Comprobante de pago</p>
            <p className="font-semibold">
              {p.comprobante_path
                ? `Cargado${p.comprobante_subido_at ? ` el ${formatFecha(p.comprobante_subido_at)}` : ''}`
                : 'Sin comprobante'}
            </p>
          </div>
        </section>

        {/* Items */}
        <section className="mb-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Detalle del pedido</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-left">
                <th className="py-2 pr-3 font-bold">#</th>
                <th className="py-2 pr-3 font-bold">Producto</th>
                <th className="py-2 pr-3 font-bold">Tipo</th>
                <th className="py-2 text-right font-bold">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b border-neutral-300">
                  <td className="py-1.5 pr-3 text-neutral-500">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-semibold">
                    {item.geneticas?.nombre ?? item.productos?.nombre ?? '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-neutral-600">
                    {item.geneticas
                      ? `Flor seca · ${labelTipo(item.geneticas.tipo)}`
                      : labelCategoriaProducto(item.productos?.categoria ?? 'otro')}
                  </td>
                  <td className="py-1.5 text-right font-bold">
                    {item.cantidad_gramos != null
                      ? formatGramos(item.cantidad_gramos)
                      : `${item.cantidad_unidades} u.`}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-2 text-right font-bold uppercase text-[11px] tracking-widest text-neutral-500">Total</td>
                <td className="py-2 text-right font-bold text-sm">
                  {[
                    totalGramos > 0 ? formatGramos(totalGramos) : null,
                    totalUnidades > 0 ? `${totalUnidades} u.` : null,
                  ].filter(Boolean).join(' + ') || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Notas */}
        {p.notas && (
          <section className="mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Notas del socio</h2>
            <p className="border border-neutral-300 rounded-lg p-3 whitespace-pre-wrap">{p.notas}</p>
          </section>
        )}

        <footer className="mt-8 pt-3 border-t border-neutral-200 text-[11px] text-neutral-400 flex justify-between">
          <span>Siembra Nativa Club — documento interno</span>
          <span>Impreso el {formatFecha(new Date(), "dd/MM/yyyy HH:mm")}</span>
        </footer>

      </div>
    </div>
  );
}
