# Lecciones aprendidas — Siembra Nativa Club

## Privacidad / REPROCANN
- Los certificados NUNCA deben tener URL pública. Siempre signed URLs con expiración corta (5 min).
- El path del certificado en `profiles.reprocann_certificado_path` es una referencia interna, nunca una URL.
- Todo acceso admin a documentos sensibles debe registrarse en `audit_log`.
- Al actualizar datos de REPROCANN, resetear el estado a 'pendiente'.

## Auth / RLS
- La función `get_my_role()` usa `SECURITY DEFINER` para evitar recursión en las policies.
- Un socio solo puede editar su propio perfil, pero NO puede cambiar su propio `rol` ni `estado`.
- El middleware refresca la sesión en TODAS las rutas, no solo las protegidas.
- La redirección por rol ocurre en el middleware, no en las páginas.

## Arquitectura
- Los pedidos están desacoplados de pagos: el modelo tiene comentarios indicando dónde agregar campos de pasarela.
- La función `descontar_stock_pedido()` usa FIFO (lotes más antiguos primero) y lock de fila para concurrencia.
- Los socios ven la vista `stock_publico` (suma por genética, sin ubicación/lote), nunca la tabla `stock` directa.

## Tipado Supabase / Build
- `@supabase/ssr@0.5.x` importa sus tipos de `@supabase/supabase-js/dist/module/lib/types`. Si supabase-js sube a 2.50+ (que reestructuró el `dist/`), esa ruta desaparece y TODOS los `.from()` colapsan a `never`. `next dev` lo ignora (SWC), pero `next build` (Vercel) falla.
  - Fix: fijar `"@supabase/supabase-js": "~2.45.0"` para mantener compatibilidad con ssr 0.5.x. NO usar `^2.45.0` (se resuelve a 2.108).
- El tipo `Database` hecho a mano debe incluir `Relationships: []` en cada tabla/vista, si no postgrest-js no lo valida.
- Verificación de build: `npx tsc --noEmit` debe dar 0 errores ANTES de `npm run build`. No correr `next build` con el dev server activo.

## Carrito unificado (flores + productos)
- `CarritoItem` es unión discriminada por `tipo_item` ('genetica' = gramos | 'producto' = unidades). Clave de item: `tipo_item:id`.
- `pedido_items` es polimórfico: genetica_id+cantidad_gramos O producto_id+cantidad_unidades (CHECK de exclusividad). `descontar_stock_pedido` descuenta FIFO las flores y resta unidades de productos.
- El límite `max_gramos_pedido` aplica SOLO a flores, no a productos.
- Catálogo y Tienda se unificaron en `/socio/tienda`; `/socio/catalogo` redirige ahí (se conserva el detalle `[id]`).

## Stack / Convenciones
- Server Actions con `useFormState` para formularios con feedback de error.
- Todos los comentarios de código en español.
- Animaciones Framer Motion: stagger en listas, fadeUp para items, spring para drawers móviles.
- `layoutId="sidebar-indicator"` para la animación del indicador activo del sidebar.

## 2026-08-25 — Cambios de UI/marketing: mostrar antes de deployar
- El usuario quiere ver una propuesta o mockup ANTES del deploy en cambios de presentacion (copy, resumenes de compra, banners). Implementar directo solo bugs y cambios mecanicos.
- En pedidos de "impacto marketinero", confirmar la mecanica exacta con un ejemplo numerico antes de codear: "restar como bonificacion" significaba envio a precio pleno arriba + resta abajo, no un cartel celebratorio.

## 2026-08-25 — Acciones que tocan la sesion propia
- Cambiar la password del usuario logueado invalida su sesion al instante: cualquier flujo que genere una clave y la muestre DESPUES de aplicarla pierde la clave si el target es uno mismo. Bloquear el caso self en el server action y ofrecer solo el cambio manual (el usuario ya conoce lo que tipeo).
- Recuperacion: PUT /auth/v1/admin/users/{id} con la service key permite resetear la password de cualquier cuenta.
