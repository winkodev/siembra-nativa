// Eventos que pueden avisar por email a los admins (Configuración → Avisos).
// Sin código de servidor: lo importan tanto lib/email.ts como la pantalla de configuración.
export type EventoAviso = 'nuevo_pedido' | 'comprobante' | 'certificado' | 'consulta';

export const EVENTOS_AVISO: { clave: EventoAviso; label: string; desc: string }[] = [
  { clave: 'nuevo_pedido', label: 'Pedido nuevo',          desc: 'Un socio confirmó un pedido' },
  { clave: 'comprobante',  label: 'Comprobante de pago',   desc: 'Un socio subió o reemplazó el comprobante' },
  { clave: 'certificado',  label: 'Certificado REPROCANN', desc: 'Un socio subió o reemplazó su certificado' },
  { clave: 'consulta',     label: 'Consulta nueva',        desc: 'Un socio envió una consulta' },
];
