-- MITOBICEL 2026-10-28: PRECIOS POR PRODUCTO Y VIDEOS GRANDES.
-- Ejecutar solo en el proyecto Supabase de MITOBICEL, después del esquema B2B v3.
-- Migración ADITIVA: no borra precios, promociones, fotos ni administradores.

ALTER TABLE public.catalog_offers
  ADD COLUMN IF NOT EXISTS price_a_pickup numeric(14,2),
  ADD COLUMN IF NOT EXISTS price_a_delivery numeric(14,2),
  ADD COLUMN IF NOT EXISTS price_b_pickup numeric(14,2),
  ADD COLUMN IF NOT EXISTS price_b_delivery numeric(14,2);

-- Precio por bulto/rollo/caja de cada producto, no total del combo.
-- Se calcula total de retiro:
-- (cantidad A × price_a_pickup) + (cantidad B × price_b_pickup)
-- Y total de envío:
-- (cantidad A × price_a_delivery) + (cantidad B × price_b_delivery)

-- Se conservan los campos legacy price_pickup y price_delivery para
-- las promociones ya publicadas; podés cargar precios independientes en el admin.

-- Opcional para Supabase PRO (no correr esta sentencia en Free).
-- Paso previo: Storage → Settings → Global file size limit: 500 MB o más.
-- Y habilitá el límite del bucket factory-media en Storage:
-- UPDATE storage.buckets
-- SET file_size_limit = 524288000
-- WHERE id = 'factory-media';
--
-- En Supabase Free la carga máxima real es 50 MB por archivo,
-- por lo que NO se puede conseguir un MP4 de 500 MB solo cambiando SQL.
-- Usá enlaces de YouTube/Vimeo o actualizá el proyecto a Pro.
-- El frontend usa TUS resumable upload (fragmentos de 6 MB, con progreso).
