-- Ajuste comercial 31/10/2026: conservar el histórico; solo normalizar etiquetas antiguas "Temper".
UPDATE public.raffle_campaigns SET store_name='MITOBICEL 1' WHERE lower(btrim(store_name))='temper';
UPDATE public.raffle_codes SET store_name='MITOBICEL 1' WHERE lower(btrim(store_name))='temper';
