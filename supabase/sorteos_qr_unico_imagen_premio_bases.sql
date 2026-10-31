-- MITOBICEL Sorteos: QR general, base legal reutilizable y foto del premio.
-- Ejecutar UNA VEZ en el proyecto Supabase de MITOBICEL, después de sorteos_mensuales.sql.
-- Compatible con los participantes, códigos de compra y ediciones ya existentes.
-- No toca datos de los Catálogos 1 y 2.
begin;

alter table public.raffle_campaigns
 add column if not exists prize_image_url text not null default '';

create table if not exists public.raffle_settings (
 id integer primary key default 1 check (id=1),
 terms text not null default '',
 free_instructions text not null default 'Sin obligación de compra: existe una opción gratuita por persona en cada edición, de acuerdo con las bases.',
 updated_at timestamptz not null default now()
);
alter table public.raffle_settings enable row level security;
revoke all on public.raffle_settings from anon,authenticated;
grant select,insert,update on public.raffle_settings to authenticated;
drop policy if exists raffle_admin_settings on public.raffle_settings;
create policy raffle_admin_settings on public.raffle_settings
 for all to authenticated
 using ((select public.raffle_is_admin()))
 with check ((select public.raffle_is_admin()));

insert into public.raffle_settings(id)
values(1) on conflict (id) do nothing;
-- Reutilizar las últimas bases efectivamente escritas por el administrador,
-- sin reemplazarlas con una plantilla ni cambiar las bases de las ediciones anteriores.
update public.raffle_settings s
set terms=(select c.terms from public.raffle_campaigns c
 where length(btrim(c.terms))>=80
 order by c.created_at desc limit 1),
 updated_at=now()
where s.id=1 and length(btrim(s.terms))=0
 and exists(select 1 from public.raffle_campaigns c where length(btrim(c.terms))>=80);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('raffle-prizes','raffle-prizes',true,5242880,array['image/png']::text[])
on conflict (id) do nothing;

drop policy if exists raffle_prizes_admin_insert on storage.objects;
create policy raffle_prizes_admin_insert on storage.objects
 for insert to authenticated
 with check (
  bucket_id='raffle-prizes'
  and (select public.raffle_is_admin())
 );
-- Public buckets provide public GET URLs; no write privileges to anonymous users.
-- Upsert disabled. Every upload uses a fresh random path; no update/delete grant needed.
commit;
