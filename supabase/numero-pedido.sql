-- ============================================================
-- SIEMBRA NATIVA CLUB - Número de orden secuencial
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Numeración real de pedidos (1, 2, 3...): asignada por la base
-- al crear el pedido, única e inmutable. Los pedidos existentes
-- se numeran por orden de creación.
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero INTEGER;

-- Backfill: numerar los pedidos existentes por fecha de creación
-- (idempotente: solo toca filas sin número, continuando desde el máximo)
WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at)
           + COALESCE((SELECT MAX(numero) FROM pedidos), 0) AS rn
  FROM pedidos
  WHERE numero IS NULL
)
UPDATE pedidos SET numero = ordenados.rn
FROM ordenados
WHERE pedidos.id = ordenados.id;

-- Secuencia para los pedidos nuevos, arrancando después del máximo actual
CREATE SEQUENCE IF NOT EXISTS pedidos_numero_seq OWNED BY pedidos.numero;
SELECT setval('pedidos_numero_seq', COALESCE((SELECT MAX(numero) FROM pedidos), 0) + 1, false);

ALTER TABLE pedidos ALTER COLUMN numero SET DEFAULT nextval('pedidos_numero_seq');
ALTER TABLE pedidos ALTER COLUMN numero SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_idx ON pedidos (numero);
