import { formatFecha, formatGramos, formatNumeroPedido, formatPrecio, labelTipo, labelCategoriaProducto } from '@/lib/utils';
import { PrintControls } from './PrintControls';
import { CertificadoReprocann } from './CertificadoReprocann';
import type { EstadoPedido } from '@/lib/types/database';

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Datos mínimos que necesita la hoja imprimible (real o de vista previa)
export interface OrdenPedidoProps {
  pedido: any;
  socio: any;
  items: any[];
  certUrl: string | null;
  certEsPdf: boolean;
  // Marca visible de que los datos son ficticios (ruta /imprimir/pedido/preview)
  preview?: boolean;
}

// Vista imprimible del pedido (hoja blanca): el navegador la manda
// a la impresora o la guarda como PDF desde el diálogo de impresión.
// Es puramente presentacional: la page real y la de preview le pasan los datos.
export function OrdenPedido({ pedido: p, socio, items, certUrl, certEsPdf, preview }: OrdenPedidoProps) {
  const totalGramos   = items.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);
  const totalUnidades = items.reduce((s, i) => s + (i.cantidad_unidades ?? 0), 0);
  const direccion = [
    [socio?.direccion, socio?.piso_depto].filter(Boolean).join(', '),
    socio?.localidad, socio?.provincia, socio?.codigo_postal,
  ].filter(Boolean).join(', ') || '—';

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PrintControls />

      {preview && (
        <div className="print:hidden fixed top-4 left-4 z-10 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold shadow-lg">
          Vista previa con datos ficticios — no es un pedido real
        </div>
      )}

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

        {/* Línea de corte: separa los datos del pedido del detalle valorizado */}
        <div className="relative border-t-2 border-dashed border-neutral-400 mt-6 mb-6" aria-hidden>
          <span className="absolute -top-2.5 left-2 bg-white px-1.5 text-neutral-400 text-[13px] leading-none">✂</span>
        </div>

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
              {p.monto_total != null && p.monto_total > 0 && (
                <>
                  {(p.monto_descuento ?? 0) > 0 && (
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-[11px] uppercase tracking-widest text-neutral-500">Descuento por cantidad</td>
                      <td className="py-1 text-right font-semibold">−{formatPrecio(p.monto_descuento)}</td>
                    </tr>
                  )}
                  {(p.monto_envio ?? 0) > 0 && (
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-[11px] uppercase tracking-widest text-neutral-500">Envío</td>
                      <td className="py-1 text-right font-semibold">{formatPrecio(p.monto_envio)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="py-2 text-right font-bold uppercase text-[11px] tracking-widest text-neutral-500">Total a abonar</td>
                    <td className="py-2 text-right font-bold text-base">{formatPrecio(p.monto_total)}</td>
                  </tr>
                </>
              )}
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

        {/* El footer cierra la orden en la hoja 1 (carta de porte + certificado van en hoja aparte) */}
        <footer className="mt-8 pt-3 border-t border-neutral-200 text-[11px] text-neutral-400 flex justify-between">
          <span>Siembra Nativa Club — Asociación Civil María Nativa Club de Cultivo</span>
          <span>Impreso el {formatFecha(new Date(), "dd/MM/yyyy HH:mm")}</span>
        </footer>

        {/* Hoja 2: carta de porte (acompaña al paquete) + certificado REPROCANN real del socio.
            La imagen del certificado tiene max-h para que todo entre en UNA hoja */}
        <section className="break-before-page">
          <CartaPorte pedido={p} socio={socio} items={items} totalGramos={totalGramos} totalUnidades={totalUnidades} direccion={direccion} />

          {certUrl && (
            <>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">
                Certificado REPROCANN
              </h2>
              <CertificadoReprocann url={certUrl} esPdf={certEsPdf} />
            </>
          )}
        </section>

      </div>
    </div>
  );
}

interface CartaPorteProps {
  pedido: any;
  socio: any;
  items: any[];
  totalGramos: number;
  totalUnidades: number;
  direccion: string;
}

// Carta de porte: texto que viaja dentro del paquete y respalda el envío
// ante un control. Va en la misma hoja que el certificado REPROCANN.
function CartaPorte({ pedido: p, socio, items, totalGramos, totalUnidades, direccion }: CartaPorteProps) {
  const contenido = items
    .map(i => {
      const nombre = i.geneticas?.nombre ?? i.productos?.nombre ?? '—';
      const cant   = i.cantidad_gramos != null ? formatGramos(i.cantidad_gramos) : `${i.cantidad_unidades} u.`;
      return `${nombre} (${cant})`;
    })
    .join(' · ');

  const totalTexto = [
    totalGramos > 0 ? formatGramos(totalGramos) : null,
    totalUnidades > 0 ? `${totalUnidades} u.` : null,
  ].filter(Boolean).join(' + ') || '—';

  return (
    <section className="mb-5 text-[11.5px] leading-snug">
      <div className="flex items-baseline justify-between border-b-2 border-neutral-900 pb-1.5 mb-2">
        <h2 className="font-bold uppercase tracking-widest text-[12px]">Carta de porte — Envío de cannabis medicinal</h2>
        <span className="text-neutral-500">Orden {formatNumeroPedido(p.numero)} · {formatFecha(p.created_at, 'dd/MM/yyyy')}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mb-2">
        <p><span className="text-neutral-500">Remitente:</span> <span className="font-semibold">Asociación Civil María Nativa Club de Cultivo</span> · CUIT 30-71848590-4</p>
        <p><span className="text-neutral-500">Destinatario:</span> <span className="font-semibold">{socio?.nombre ?? '—'}</span> · DNI {socio?.dni ?? '—'}</p>
        <p className="col-span-2"><span className="text-neutral-500">Domicilio de entrega:</span> {direccion}</p>
        <p><span className="text-neutral-500">Contenido total:</span> <span className="font-semibold">{totalTexto}</span></p>
        <p className="col-span-2"><span className="text-neutral-500">Detalle:</span> {contenido}</p>
      </div>

      <p className="text-justify text-neutral-700 mb-2">
        El destinatario es socio de la Asociación Civil María Nativa Club de Cultivo, CUIT N.° 30-71848590-4,
        organización inscripta y autorizada por el Ministerio de Salud de la Nación en el marco del Registro del
        Programa de Cannabis (REPROCANN) y la Ley N.° 27.350. La Asociación, en su carácter de cultivador
        solidario/ONG habilitada, emite la presente Carta de Porte con carácter de declaración jurada, a los efectos
        de amparar el traslado de material vegetal (cannabis y/o sus derivados) correspondiente a los socios
        inscriptos de la organización, conforme la autorización vigente otorgada por dicho Ministerio.
      </p>
    </section>
  );
}
