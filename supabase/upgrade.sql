-- Si instalaste la versión anterior de Mitobicel en Supabase:
-- Ejecutar una sola vez; conserva tus precios.
alter table public.catalog_items add column if not exists image_url text;
update public.catalog_items
 set title='Bolsas de basura en rollito fondo estrella',subtitle='Residuos'
 where category='residuos';
delete from public.catalog_items where id='film-otros' and category='film';
insert into public.catalog_items(id,category,title,subtitle,measure,presentation,position,featured,enabled)
 values('res-60','residuos','Bolsas de basura en rollito fondo estrella','Residuos','60 × 90','Bulto',32,false,true)
 on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('catalog-images','catalog-images',true,3145728,ARRAY['image/png','image/jpeg','image/webp'])
 on conflict (id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
do $do$
begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mitobicel admin category uploads') then
  create policy "mitobicel admin category uploads" on storage.objects
   for insert to authenticated
   with check (bucket_id='catalog-images' and exists(
    select 1 from public.admin_users where user_id=(select auth.uid())));
 end if;
end $do$;
