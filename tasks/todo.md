# Siembra Nativa Club — Pendientes

## ✅ 2026-08-19: Alertas REPROCANN — módulo cerrado

- El grueso ya estaba (commit af7a006, 18/08): cron pg_cron diario (`procesar_vencimientos_reprocann`,
  09:00 UTC) que marca vencidos, apaga `compra_habilitada` y notifica al socio con anticipación
  configurable (`reprocann_aviso_dias` = 60 en prod). SQL `avisos-y-descuentos.sql` verificado
  ejecutado en Supabase (config presente vía REST).
- Cierre de hoy (674bfd0): `estadoEfectivoReprocann()` — los badges (Inicio socio, perfil,
  tabla/filtros admin) muestran "Vencido" por fecha sin esperar al cron. Se eliminó
  `reprocannVigente()` (no se usaba). `tsc --noEmit` = 0.

## 🟢 EN CURSO: Reserva de stock + comprobante de pago (2026-08-14)

**Objetivo:** (a) que los gramos/unidades de un pedido pendiente queden reservados (invisibles
en tienda) hasta que el admin apruebe o cancele; (b) que el socio pueda subir un comprobante
de pago y el admin verlo antes de aprobar.

**Decisión:** reserva *virtual* — el stock físico no se toca al pedir; las vistas
`stock_publico` y `productos_publico` restan lo comprometido en pedidos pendientes.
El descuento FIFO real sigue ocurriendo al aprobar. Comprobante en bucket privado
`comprobantes-pago` (mismo patrón que certificados REPROCANN, con audit log).

1. [x] **DB** — `supabase/reserva-y-comprobante.sql` ejecutada en Supabase (verificado 2026-08-14).
2. [x] **Tipos** — Pedido con comprobante, vista `productos_publico`, función restaurar.
3. [x] **Config** — `AppConfig.comprobante_obligatorio` + toggle en `/admin/configuracion`.
4. [x] **Actions** — `crearPedido` valida contra vistas netas; `cambiarEstadoPedido` con
   guard de transiciones (lock optimista), restaura stock al cancelar aprobados y exige
   comprobante si es obligatorio; `subirComprobante` (socio) y `verComprobante` (admin,
   signed URL 5 min + audit_log).
5. [x] **Tienda** — tienda y detalle de producto leen `productos_publico` (stock neto de reservas).
6. [x] **UI socio** — subir/reemplazar comprobante en el detalle del pedido (pendiente/aprobado).
7. [x] **UI admin** — indicador en la fila + "Ver comprobante" en el detalle.
- `tsc --noEmit` = 0 (2026-08-14). Nota: la ventana de carrera entre validación y creación
  del pedido sigue existiendo (milisegundos); a escala de club es aceptable y la aprobación
  igualmente falla con error claro si el stock físico no alcanza.
- Extra 2026-08-14: inventario admin muestra disponible real + "X reservado · físico Y".
- Blanqueo capa 1 ejecutado 2026-08-14 (pedidos, items, stock, audit, comprobantes).
  Conservados: perfiles, catálogo, config.

## 🟢 EN CURSO: Estadísticas (`/admin/estadisticas`)

- [x] `supabase/estadisticas.sql`: columna `pedidos.fecha_entregado` + función
  `estadisticas_club(desde, hasta, agrupacion)` (solo admin, JSON en una pasada) —
  **PENDIENTE EJECUTAR en Supabase**.
- [x] `cambiarEstadoPedido` fija `fecha_entregado` al marcar entregado.
- [x] Página con presets (mes, mes pasado, 30/90 días, año) + rango libre + agrupación
  día/semana/mes (query params, refetch server-side).
- [x] KPIs: gramos dispensados, unidades, pedidos, promedio por entrega, socios nuevos/activos.
- [x] Gráficos Recharts: dispensado en el tiempo, pedidos por estado (barras etiquetadas),
  top 5 genéticas, altas de socios. Paleta validada sobre fondo oscuro.
- [x] Item "Estadísticas" en el sidebar admin. `tsc --noEmit` = 0.

## ✅ 2026-08-14 (noche): franjas de entrega + orden imprimible

- [x] `supabase/franjas-horarias.sql`: tabla `franjas_horarias` (dia, desde, hasta, activa;
  RLS: socios ven activas, admin todo) + `pedidos.entrega_franja` (foto del texto) —
  **PENDIENTE EJECUTAR en Supabase**.
- [x] ABM en /admin/configuracion → tab "Horarios" (crear/editar/activar/eliminar + audit).
- [x] Checkout socio: selector de franja obligatorio si hay activas; placeholder de notas
  corregido (era "horario de retiro" → el concepto es ENTREGA). Sin franjas definidas,
  no se pide horario.
- [x] Franja visible en historial del socio y detalle admin.
- [x] Vista imprimible `/imprimir/pedido/[id]` (hoja blanca A4: datos del socio con
  teléfono/dirección/REPROCANN, horario de entrega, comprobante, tabla de items, firmas).
  Botón "Imprimir" en el detalle del pedido admin; el PDF se genera desde el diálogo de
  impresión del navegador. Acceso registrado en audit_log (imprimir_pedido).
- [x] `tsc --noEmit` = 0.

## ✅ 2026-08-14 (tarde): dashboard admin + auditoría + fixes

- [x] Stock por lote: `cantidad_inicial` (ingresado, inmutable) vs `cantidad_gramos`
  (restante, FIFO descuenta ahí). Tabla muestra Ingresado/Restante/"agotado".
  Migración `stock-cantidad-inicial.sql` ejecutada; lote de prueba corregido a 100g.
- [x] Genéticas: calidad (regular/premium) y cultivo (indoor/outdoor) — ABM admin +
  badges en tienda y detalle (`genetica-atributos.sql` ejecutada).
- [x] Dashboard admin: "Documentación pendiente de revisión" (renombrado) + listas
  "Pedidos por aprobar" y "Pedidos por entregar" (con socio, fecha, contenido e ícono
  de comprobante).
- [x] Auditoría: `registrarAccion()` en `lib/audit.ts` instrumentado en TODAS las
  actions de admin (config, ubicaciones, genéticas, stock, productos, pedidos,
  newsletter, socios/REPROCANN, notas). Tab "Actividad" en /admin/configuracion
  con filtro por módulo. Reusa la tabla audit_log existente — sin migración.
- [x] Newsletter: "Ver más/Ver menos" en el dashboard del socio + `remark-breaks`
  (los Enter simples ahora cortan línea) en dashboard, lista admin y vista previa.

## 🟢 EN CURSO: Ficha del socio + log de notas

- [x] `supabase/socio-notas.sql`: tabla `socio_notas` (tipo: general/consulta_medica/
  reprocann/pago, RLS solo admin, migra `profiles.notas_admin` existentes) —
  **PENDIENTE EJECUTAR en Supabase**.
- [x] Actions: `obtenerFichaSocio` (stats + notas), `agregarNotaSocio`, `eliminarNotaSocio`.
  Se eliminó `actualizarNotasAdmin` (campo único deprecado).
- [x] Drawer del socio: sección "Actividad" (pedidos totales/entregados, gramos retirados,
  promedio por entrega, último pedido) + log de notas fechadas con tipo y eliminación.
- [x] `tsc --noEmit` = 0.

**Verificación:** `tsc --noEmit` = 0; pedido pendiente resta stock visible en tienda;
cancelar pendiente lo libera; aprobar descuenta FIFO; cancelar aprobado devuelve stock;
comprobante visible solo vía signed URL.

---

## 🟢 EN CURSO: Unificar Catálogo + Tienda (carrito unificado)

**Objetivo:** una sola sección "Tienda" para el socio con flores secas (genéticas) y productos
(aceite, otros) juntos, filtro Flores secas / Aceites / Otros, todo al mismo carrito y un único pedido.

**Decisión:** "Todo al carrito". NO se fusionan las tablas `geneticas` y `productos` (se mantiene
FIFO por lote y el admin intacto). Se unifica la presentación y el pedido pasa a ser polimórfico.

1. **DB** — `supabase/unificar-pedidos.sql`: `pedido_items` con `producto_id` + `cantidad_unidades`,
   `genetica_id`/`cantidad_gramos` nullables, CHECK de exclusividad. Ampliar `descontar_stock_pedido`
   para descontar `productos.stock` por unidades además del FIFO de genéticas.
   - [ ] migración
2. **Tipos** — `CarritoItem` como unión discriminada (`tipo_item`), `PedidoItem`/`PedidoConItems` con productos.
   - [ ] tipos
3. **Carrito** — reducer con clave `tipo_item:id`; drawer: gramos para flores, unidades para productos;
   límite max_gramos solo cuenta flores.
   - [ ] CarritoContext + CarritoDrawer
4. **Página unificada** — nueva `TiendaClient` combinando `stock_publico` + `productos`, filtro + buscador.
   - [ ] tienda
5. **Pedido** — `crearPedido` separa flores/productos, valida límite y stock de cada uno; confirmación lista ambos.
   - [ ] action + nuevo/page
6. **Vistas de pedidos** — joins a `geneticas` y `productos` en admin y socio.
   - [ ] admin + historial
7. **Navegación** — sidebar deja solo "Tienda"; `/socio/catalogo` redirige a `/socio/tienda` (se conserva detalle).
   - [ ] nav + redirects

**Verificación:** `npm run dev`, agregar flor + aceite, confirmar pedido, aprobar en admin y verificar
descuento (gramos FIFO + unidades). Chequear bloqueos por compra_habilitada / REPROCANN.

### Review (hecho)
- [x] Migración `supabase/unificar-pedidos.sql` (pedido_items polimórfico + descontar_stock_pedido) — ejecutada en Supabase (verificado 2026-08-14).
- [x] Tipos: `CarritoItem` unión discriminada (`tipo_item`), `PedidoItem`/`PedidoConItems` con productos.
- [x] Carrito polimórfico (clave `tipo_item:id`); drawer con gramos (flores) y stepper de unidades (productos); límite solo cuenta flores. Carrito viejo de localStorage se descarta para evitar corrupción.
- [x] `/socio/tienda` unificada (flores + productos, filtro Todos/Flores secas/Aceites/Otros, buscador). Productos se agregan inline; flores enlazan a su detalle.
- [x] `crearPedido` separa flores/productos, valida límite y stock de cada uno.
- [x] Vistas de pedidos (admin + socio) con join a productos; totales separan gramos (flores) de unidades.
- [x] Sidebar deja solo "Tienda"; `/socio/catalogo` redirige a `/socio/tienda` (se conserva `[id]`); links actualizados.
- Nota: los errores `never` de tipado Supabase se resolvieron pineando `supabase-js` en `~2.45.0` (ver lessons.md); `tsc --noEmit` da 0 errores (verificado 2026-08-14).
- 2026-08-14: ejecutada `configuracion-app.sql` en Supabase + política de lectura para autenticados (sin ella, los socios leían `[]` y `getAppConfig()` caía a defaults).

---

## ✅ COMPLETADO
- Estructura del proyecto Next.js 14 + TypeScript
- Esquema SQL completo (tablas, RLS, bucket privado)
- Tailwind con paleta del club (#083D3A / #F3A707)
- Supabase client/server/middleware + tipos TypeScript
- Middleware de auth con redirección por rol
- Landing page con logo centrado y animaciones
- Login + Registro con panel lateral
- Layout base SOCIO con sidebar animado (desktop + mobile drawer)
- Layout base ADMIN con sidebar
- Dashboard de socio (estado REPROCANN + accesos rápidos + newsletter)
- Dashboard de admin (métricas: stock, pedidos, socios, REPROCANN por vencer)
- Onboarding perfil + datos personales (nombre, DNI, email, teléfono, dirección)
- Carga de REPROCANN (número, categoría, vencimiento, certificado)
- Componente ReprocannStatus con alertas de vencimiento
- Inventario admin: ABM de genéticas (crear/editar/imagen/activar/eliminar)
- Inventario admin: Stock (ingresos, log de movimientos, editar, eliminar)

---

## 🔴 MÓDULO: CATÁLOGO + PEDIDOS (Socio)

### Catálogo de genéticas
- [ ] Página `/socio/catalogo` con cards de genéticas
- [ ] Filtro por tipo (índica/sativa/híbrida)
- [ ] Badge de stock disponible (en gramos)
- [ ] Animaciones hover en cards
- [ ] Bloqueo visual si REPROCANN no vigente

### Detalle de genética
- [ ] Página `/socio/catalogo/[id]`
- [ ] Info completa (THC, CBD, descripción, imagen)
- [ ] Botón "Agregar al pedido" (bloqueado si REPROCANN no vigente)
- [ ] Selector de cantidad en gramos (con límite de stock disponible)

### Carrito
- [ ] Contexto global de carrito (React Context o Zustand)
- [ ] Componente carrito flotante o drawer
- [ ] Agregar / quitar items
- [ ] Persistencia básica (localStorage)

### Confirmar pedido
- [ ] Página `/socio/pedidos/nuevo`
- [ ] Resumen del carrito con totales
- [ ] Campo de notas opcionales
- [ ] Validación REPROCANN vigente antes de confirmar
- [ ] Server action que crea pedido + items en DB
- [ ] Pantalla de confirmación exitosa

### Mis Pedidos (socio)
- [ ] Página `/socio/pedidos` con historial
- [ ] Badge de estado (pendiente/aprobado/entregado/cancelado)
- [ ] Detalle expandible de cada pedido (qué genéticas, cuántos gramos)

---

## 🔴 MÓDULO: GESTIÓN ADMIN

### Socios
- [ ] Página `/admin/socios` con tabla de todos los socios
- [ ] Filtros: por estado REPROCANN, por estado de cuenta
- [ ] Detalle de socio `/admin/socios/[id]`
- [ ] Ver certificado REPROCANN (signed URL de 5 min + log de auditoría)
- [ ] Aprobar / rechazar REPROCANN
- [ ] Campo notas_admin (visible solo para admin)
- [ ] Activar / desactivar cuenta de socio

### Gestión de pedidos (admin)
- [ ] Página `/admin/pedidos` con lista de todos los pedidos
- [ ] Filtro por estado
- [ ] Cambio de estado (pendiente → aprobado → entregado / cancelado)
- [ ] Al aprobar: descontar stock automáticamente (función SQL FIFO)
- [ ] Detalle del pedido con items

### Newsletter
- [ ] Página `/admin/newsletter` con lista de publicaciones
- [ ] Editor markdown (crear / editar / publicar / despublicar)
- [ ] Vista previa del contenido
- [ ] Imagen de portada opcional

---

## 🟡 MÓDULO: ALERTAS Y NOTIFICACIONES

- [ ] Alerta admin: socios con REPROCANN por vencer (próximos 30 días)
- [ ] Alerta admin: socios con REPROCANN vencido
- [ ] Alerta socio: su REPROCANN está por vencer (banner en dashboard)
- [ ] Cron job en Supabase para marcar REPROCANN vencidos automáticamente

---

## 🟡 MÓDULO: AUDIT LOG

- [ ] Página `/admin/audit` con log de accesos a documentos sensibles
- [ ] Filtro por admin, por socio afectado, por fecha

---

## 🟡 PERFIL AMPLIADO

- [ ] Página de perfil del socio mejorada (ver datos cargados, editar)
- [ ] Foto de perfil (opcional)

---

## 🔵 DEPLOY Y PRODUCCIÓN

- [ ] Instalar fuentes (Avigea + Century Gothic) en `/public/fonts/`
- [ ] Configurar proyecto en Vercel
- [ ] Variables de entorno en Vercel
- [ ] Agregar dominio de producción en Supabase (Redirect URLs)
- [ ] Configurar emails personalizados (Supabase → Authentication → Email Templates)
- [ ] Cron job pg_cron para marcar REPROCANN vencidos diariamente

---

## 🔵 FUTURO (post-MVP)

- [ ] Integración pasarela de pago (Mercado Pago) — el modelo ya está desacoplado
- [ ] App móvil con Expo (reutilizando tipos y lógica)
- [ ] Validación externa de REPROCANN (cuando exista API oficial)
- [ ] Notificaciones push
- [ ] Reportes y exportación de datos (CSV)
