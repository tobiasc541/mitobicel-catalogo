-- Ejecutar en Supabase MITOBICEL si las 176 filas ya estan cargadas.
-- No modifica tablas del QR ni precios editados manualmente.
BEGIN;

-- Correccion retroactiva SEGURA: solo completar 14 precios que quedaron pendientes
-- por la regla incorrecta anterior, sin sobrescribir precios editados manualmente.
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

COMMIT;
SELECT count(*) AS productos_con_precio_de_lista FROM public.catalog_full_items WHERE id LIKE 'prov26-%' AND price_list IS NOT NULL;
