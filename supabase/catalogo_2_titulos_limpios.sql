BEGIN;
UPDATE public.catalog_full_items
SET title='MITOBICEL Blue más que premium gofrada'
WHERE id='prov26-025' AND title='MITOBICEL Blue más que premium gofrada (la imagen dice Blue; texto incrustado dice Negra)';
UPDATE public.catalog_full_items
SET title='MITOBICEL verde más que premium gofrada'
WHERE id='prov26-026' AND title='MITOBICEL verde más que premium gofrada (imagen, página sin texto extraíble)';
COMMIT;
