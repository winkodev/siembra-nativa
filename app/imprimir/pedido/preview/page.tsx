import { getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OrdenPedido } from '../[id]/OrdenPedido';

export const metadata = { title: 'Vista previa — orden de pedido' };

// Certificado ficticio: SVG con proporción A4 embebido como data URL.
// Sirve para ver cómo queda la hoja 2 sin acceder a ningún certificado real.
const CERT_FICTICIO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
      <rect width="794" height="1123" fill="#f3f4f6" stroke="#9ca3af" stroke-width="4"/>
      <text x="397" y="520" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#6b7280">CERTIFICADO REPROCANN</text>
      <text x="397" y="580" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#9ca3af">(imagen ficticia de vista previa)</text>
    </svg>
  `);

// Datos inventados con el mismo formato que devuelve Supabase
const PEDIDO_FICTICIO = {
  id: 'preview',
  numero: 9999,
  socio_id: 'preview',
  estado: 'aprobado',
  notas: 'Pedido de ejemplo para revisar el diseño de la impresión.',
  comprobante_path: 'preview/comprobante.jpg',
  comprobante_subido_at: new Date().toISOString(),
  entrega_franja: 'Envío a domicilio',
  monto_total: 48500,
  monto_envio: 3500,
  monto_descuento: 2000,
  created_at: new Date().toISOString(),
};

const SOCIO_FICTICIO = {
  nombre: 'Juan Pérez',
  dni: '30.123.456',
  telefono: '11 5555-1234',
  email: 'juan.perez@ejemplo.com',
  direccion: 'Av. Siempre Viva 742',
  piso_depto: '3° B',
  localidad: 'Rosario',
  provincia: 'Santa Fe',
  codigo_postal: '2000',
  reprocann_numero: 'RC-000000',
  reprocann_certificado_path: null,
};

const ITEMS_FICTICIOS = [
  { id: 'i1', cantidad_gramos: 20, cantidad_unidades: null, geneticas: { nombre: 'Gorilla Glue', tipo: 'hibrida' }, productos: null },
  { id: 'i2', cantidad_gramos: 10, cantidad_unidades: null, geneticas: { nombre: 'Northern Lights', tipo: 'indica' }, productos: null },
  { id: 'i3', cantidad_gramos: null, cantidad_unidades: 1, geneticas: null, productos: { nombre: 'Aceite full spectrum 30 ml', categoria: 'aceite' } },
];

// Vista previa de la hoja imprimible con datos ficticios. No lee ni escribe
// nada en la base: sirve para revisar el diseño en producción sin armar un pedido.
export default async function PreviewOrdenPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  return (
    <OrdenPedido
      pedido={PEDIDO_FICTICIO}
      socio={SOCIO_FICTICIO}
      items={ITEMS_FICTICIOS}
      certUrl={CERT_FICTICIO}
      certEsPdf={false}
      preview
    />
  );
}
