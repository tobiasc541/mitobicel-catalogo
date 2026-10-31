-- MITOBICEL: portada PNG independiente y persistente para el home de Sorteos.
-- Aplicar después de sorteos_qr_unico_imagen_premio_bases.sql.
-- No modifica participantes, premios, fechas, catálogos ni QR.
begin;
alter table public.raffle_settings add column if not exists hero_image_url text not null default '';
-- Up to 6 MB for a transparently composited poster. Existing public bucket.
update storage.buckets set file_size_limit=6291456 where id='raffle-prizes' and file_size_limit<6291456;
create or replace function public.raffle_public_hero_image()
returns text language sql stable security definer set search_path='' as $$
 select coalesce((select s.hero_image_url from public.raffle_settings s where s.id=1),'');
$$;
revoke all on function public.raffle_public_hero_image() from public,anon,authenticated;
grant execute on function public.raffle_public_hero_image() to anon,authenticated;
commit;
