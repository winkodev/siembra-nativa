import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { registrarAccion } from '@/lib/audit';
import { OrdenPedido } from './OrdenPedido';

export const metadata = { title: 'Imprimir pedido' };

interface Props {
  params: { id: string };
}

// Carga el pedido real y lo pasa a la hoja imprimible.
// Para ver el diseño sin un pedido real: /imprimir/pedido/preview
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
      profiles!socio_id ( nombre, dni, telefono, email, direccion, piso_depto, localidad, provincia, codigo_postal, reprocann_certificado_path )
    `)
    .eq('id', params.id)
    .single();

  if (!pedido) notFound();

  const p = pedido as any;
  const socio = p.profiles;
  const items = p.pedido_items as any[];

  // La orden contiene datos personales: se registra el acceso
  await registrarAccion(supabase, 'imprimir_pedido', 'pedidos', { pedido_id: p.id }, p.socio_id);

  // Certificado REPROCANN real: signed URL de 5 minutos (nunca URL pública)
  let certUrl: string | null = null;
  let certEsPdf = false;
  if (socio?.reprocann_certificado_path) {
    const { data: signed } = await supabase.storage
      .from('certificados-reprocann')
      .createSignedUrl(socio.reprocann_certificado_path, 300);
    if (signed?.signedUrl) {
      certUrl   = signed.signedUrl;
      certEsPdf = socio.reprocann_certificado_path.toLowerCase().endsWith('.pdf');
      // Acceso a documento sensible: queda auditado
      await registrarAccion(supabase, 'ver_certificado', 'profiles', { pedido_id: p.id }, p.socio_id);
    }
  }

  return <OrdenPedido pedido={p} socio={socio} items={items} certUrl={certUrl} certEsPdf={certEsPdf} />;
}
