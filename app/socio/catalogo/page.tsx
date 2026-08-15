import { redirect } from 'next/navigation';

// El catálogo se unificó con la tienda. Se conserva el detalle en /socio/catalogo/[id].
export default function CatalogoPage() {
  redirect('/socio/tienda');
}
