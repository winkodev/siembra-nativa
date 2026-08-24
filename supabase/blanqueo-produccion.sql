-- ============================================================
-- SIEMBRA NATIVA CLUB - Blanqueo pre-producción
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Borra TODOS los datos transaccionales de prueba y resetea la
-- numeración de pedidos a 1. Es IRREVERSIBLE.
--
-- SE CONSERVA:
--   - Cuentas y perfiles (auth.users / profiles) con sus certificados
--   - Catálogo: geneticas, productos, ubicaciones
--   - Configuración: configuracion_app, franjas_horarias
--   - Newsletter (publicaciones)
--
-- SE BORRA:
--   - Pedidos e items (y sus comprobantes de pago en Storage)
--   - Lotes de stock (flores) y stock de productos (queda en 0)
--   - Notificaciones, notas de socios y log de auditoría
-- ============================================================

BEGIN;

-- Pedidos y sus items (el orden respeta las FK)
DELETE FROM pedido_items;
DELETE FROM pedidos;

-- Stock: lotes de prueba de flores + unidades de productos a cero
DELETE FROM stock;
UPDATE productos SET stock = 0;

-- Historial de prueba
DELETE FROM notificaciones;
DELETE FROM socio_notas;
DELETE FROM audit_log;

-- Numeración de pedidos: el próximo pedido será el N° 1
SELECT setval('pedidos_numero_seq', 1, false);

-- Comprobantes de pago subidos durante las pruebas (Storage)
DELETE FROM storage.objects WHERE bucket_id = 'comprobantes-pago';

COMMIT;

-- ============================================================
-- Verificación: todo debe dar 0, y el próximo número de pedido es 1
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM pedidos)            AS pedidos,
  (SELECT COUNT(*) FROM pedido_items)       AS items,
  (SELECT COUNT(*) FROM stock)              AS lotes_stock,
  (SELECT COALESCE(SUM(stock), 0) FROM productos) AS unidades_productos,
  (SELECT COUNT(*) FROM notificaciones)     AS notificaciones,
  (SELECT COUNT(*) FROM socio_notas)        AS notas,
  (SELECT COUNT(*) FROM audit_log)          AS audit,
  (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'comprobantes-pago') AS comprobantes,
  (SELECT last_value FROM pedidos_numero_seq) AS proximo_numero_pedido;
