import { redirect } from 'next/navigation';

// El registro público está deshabilitado: las altas las hace el club
// desde /admin/socios (invitación por email o contraseña temporal).
export default function RegistroPage() {
  redirect('/login');
}
