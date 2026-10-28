-- MITOBICEL B2B v3: Ejecutar en SQL Editor del proyecto MITOBICEL.
-- Aditivo: no borra catalog_items, precios ni admin_users existentes.
create table if not exists public.site_settings (
 key text primary key, value text not null default ''
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon,authenticated;
grant insert,update on public.site_settings to authenticated;
do $do$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='public read site settings') then
 create policy "public read site settings" on public.site_settings for select to anon,authenticated using(true);end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='admin insert site settings') then
 create policy "admin insert site settings" on public.site_settings for insert to authenticated
 with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='admin update site settings') then
 create policy "admin update site settings" on public.site_settings for update to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
end $do$;
insert into public.site_settings(key,value) values
('factory_video_url',''),
('factory_video_poster',''),
('video_title','Calidad que podés ver en vivo antes de hacer tu pedido'),
('video_caption','Conocé el proceso productivo de MITOBICEL.'),
('social_proof_text','La confianza se construye con calidad, atención y precios de fábrica.'),
('proof_count',''),
('proof_rating',''),
('proof_verified','false')
on conflict(key) do nothing;

create table if not exists public.catalog_offers (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 product_a_id text not null references public.catalog_items(id),
 product_b_id text references public.catalog_items(id),
 quantity_a integer not null check (quantity_a>0),
 quantity_b integer not null default 0,
 unit_a text not null default 'bultos' check (unit_a in ('bultos','rollos','cajas')),
 unit_b text not null default 'bultos' check (unit_b in ('bultos','rollos','cajas')),
 price_pickup numeric(14,2) check (price_pickup is null or price_pickup>=0),
 price_delivery numeric(14,2) check (price_delivery is null or price_delivery>=0),
 price_old numeric(14,2) check (price_old is null or price_old>=0),
 price_mode text not null default 'combo' check (price_mode in ('combo','por_bulto')),
 active boolean not null default true,
 sort_order integer not null default 1,
 constraint offer_product_difference check(product_b_id is null or product_b_id<>product_a_id),
 constraint offer_valid_second_quantity check(
 (product_b_id is null and quantity_b=0) or (product_b_id is not null and quantity_b>0))
);
alter table public.catalog_offers enable row level security;
grant select on public.catalog_offers to anon,authenticated;
grant insert,update,delete on public.catalog_offers to authenticated;
do $do$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalog_offers' and policyname='public view active offers') then
 create policy "public view active offers" on public.catalog_offers for select to anon using(active);end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalog_offers' and policyname='admin view offers') then
 create policy "admin view offers" on public.catalog_offers for select to authenticated
 using(active or exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalog_offers' and policyname='admin insert offers') then
 create policy "admin insert offers" on public.catalog_offers for insert to authenticated
 with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalog_offers' and policyname='admin update offers') then
 create policy "admin update offers" on public.catalog_offers for update to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalog_offers' and policyname='admin delete offers') then
 create policy "admin delete offers" on public.catalog_offers for delete to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
end $do$;

-- Conserva y migra promociones creadas en la versión anterior cuando existen.
do $do$ begin
 if to_regclass('public.combo_promotions') is not null then
 insert into public.catalog_offers(id,title,description,product_a_id,product_b_id,quantity_a,quantity_b,unit_a,unit_b,price_pickup,price_delivery,price_old,price_mode,active,sort_order)
 select id,title,description,product_a_id,product_b_id,quantity_a,quantity_b,'bultos','bultos',price_pickup,price_delivery,null,'combo',active,sort_order
 from public.combo_promotions
 on conflict(id) do nothing;
 end if;
end $do$;

-- Fotos y videos institucionales. Límite 45 MB por archivo MP4.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('factory-media','factory-media',true,47185920,ARRAY['video/mp4','image/png','image/jpeg','image/webp'])
 on conflict(id) do update set public=true,file_size_limit=47185920,allowed_mime_types=excluded.allowed_mime_types;
do $do$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mitobicel admin factory media') then
 create policy "mitobicel admin factory media" on storage.objects for insert to authenticated
 with check(bucket_id='factory-media' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));end if;
end $do$;
