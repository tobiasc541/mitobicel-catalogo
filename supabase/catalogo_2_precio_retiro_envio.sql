-- MITOBICEL · Catálogo 2: retiro en fábrica + envío por presentación
-- SOLO public.catalog_full_items: el catálogo del QR no se modifica.
-- Las 176 presentaciones de la lista tienen su precio de retiro ya calculado.
-- Se suman ARS $1.000 únicamente a bultos, cajas o atados expresados en ARS.
-- Tubos, unidades, paquetes sueltos y precios por kg: envío no definido.
-- En USD se conserva el importe y no se suman pesos a dólares.
-- Actualizaciones idempotentes: solo donde el valor todavía sea NULL.
BEGIN;
UPDATE public.catalog_full_items AS dest
SET price_list=correction.price_list,requires_quote=false
FROM (VALUES
 ('prov26-117',365,365),
 ('prov26-137',2870,2870),
 ('prov26-138',2870,2870),
 ('prov26-139',2550,2550),
 ('prov26-156',2700,2700),
 ('prov26-168',300,300),
 ('prov26-169',400,400),
 ('prov26-170',450,450),
 ('prov26-171',650,650),
 ('prov26-172',950,950),
 ('prov26-173',1250,1250),
 ('prov26-174',1250,1250),
 ('prov26-175',2100,2100),
 ('prov26-176',2700,2700)
) AS correction(id,original_price,price_list)
WHERE dest.id=correction.id
  AND dest.currency='ARS'
  AND dest.price_list IS NULL
  AND dest.requires_quote=true
  AND dest.source_original_price=correction.original_price;


-- Corrección de 4 tubos por unidad de venta, sin tocar precios editados.
UPDATE public.catalog_full_items AS dest
SET price_list=fix.correct_price, requires_quote=false
FROM (VALUES
('prov26-119',6500::numeric,2500::numeric),
('prov26-121',6200::numeric,2200::numeric),
('prov26-123',9250::numeric,5250::numeric),
('prov26-125',9250::numeric,5250::numeric)
) AS fix(id,correct_price,wrong_price)
WHERE dest.id=fix.id
 AND dest.currency='ARS'
 AND dest.presentation ILIKE 'Tubo%'
 AND dest.source_original_price=fix.correct_price
 AND dest.price_list=fix.wrong_price;


-- Si ya se migró por error un tubo con el importe descontado, se corrige
-- únicamente cuando coinciden el precio equivocado y el valor PDF.
UPDATE public.catalog_full_items AS dest
SET price_pickup=fix.correct_price
FROM (VALUES
  ('prov26-119',6500::numeric,2500::numeric),
  ('prov26-121',6200::numeric,2200::numeric),
  ('prov26-123',9250::numeric,5250::numeric),
  ('prov26-125',9250::numeric,5250::numeric)
) AS fix(id,correct_price,wrong_price)
WHERE dest.id=fix.id
  AND dest.currency='ARS'
  AND dest.presentation ILIKE 'Tubo%'
  AND dest.source_original_price=fix.correct_price
  AND dest.price_pickup=fix.wrong_price;

UPDATE public.catalog_full_items
SET price_pickup=price_list
WHERE id ~ '^prov26-[0-9]{3}$'
  AND price_list IS NOT NULL
  AND price_pickup IS NULL;

UPDATE public.catalog_full_items
SET price_delivery=price_pickup+1000
WHERE id ~ '^prov26-[0-9]{3}$'
  AND currency='ARS'
  AND presentation ~* '^(bulto|caja|atado)'
  AND price_pickup IS NOT NULL
  AND price_delivery IS NULL;
COMMIT;
SELECT count(*) FILTER (WHERE price_pickup IS NOT NULL) AS con_precio_retiro,
       count(*) FILTER (WHERE price_delivery IS NOT NULL) AS con_precio_envio
FROM public.catalog_full_items WHERE id ~ '^prov26-[0-9]{3}$';
