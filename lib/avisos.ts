// Eventos que pueden avisar por email a los admins (Configuración → Avisos).
// Sin código de servidor: lo importan tanto lib/email.ts como la pantalla de configuración.
export type EventoAviso = 'nuevo_pedido' | 'comprobante' | 'certificado' | 'consulta';

export const EVENTOS_AVISO: { clave: EventoAviso; label: string; desc: string }[] = [
  { clave: 'nuevo_pedido', label: 'Pedido nuevo',          desc: 'Un socio confirmó un pedido' },
  { clave: 'comprobante',  label: 'Comprobante de pago',   desc: 'Un socio subió o reemplazó el comprobante' },
  { clave: 'certificado',  label: 'Certificado REPROCANN', desc: 'Un socio subió o reemplazó su certificado' },
  { clave: 'consulta',     label: 'Consulta nueva',        desc: 'Un socio envió una consulta' },
];

// Método de envío: se elige en Configuración → Avisos (clave avisos_proveedor)
export type ProveedorEmail = 'auto' | 'resend' | 'gmail';
export const PROVEEDORES_EMAIL: { clave: ProveedorEmail; label: string; desc: string }[] = [
  { clave: 'auto',   label: 'Automático', desc: 'Usa Gmail si está configurado, si no Resend' },
  { clave: 'gmail',  label: 'Gmail',      desc: 'Sale desde la cuenta de Gmail del club (contraseña de aplicación)' },
  { clave: 'resend', label: 'Resend',     desc: 'Sale desde el dominio verificado en Resend' },
];

// Credenciales de envío que el superadmin puede cargar desde la app
// (si la variable de entorno existe en el servidor, esa manda)
export const CLAVES_SECRETO_EMAIL = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RESEND_API_KEY', 'EMAIL_FROM'] as const;
export type ClaveSecretoEmail = (typeof CLAVES_SECRETO_EMAIL)[number];
