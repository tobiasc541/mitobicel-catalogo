-- Ejecutar SOLO en un proyecto Supabase nuevo de MITOBICEL.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;
create policy "admins see own membership" on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.catalog_items(
 id text primary key,
 category text not null,
 title text not null,
 subtitle text not null default '',
 measure text not null,
 presentation text not null default '',
 packages integer,
 bags_per_roll integer,
 units_per_box integer,
 price_pickup numeric(14,2) check (price_pickup is null or price_pickup >= 0),
 price_delivery numeric(14,2) check (price_delivery is null or price_delivery >= 0),
 featured boolean not null default false,
 enabled boolean not null default true,
 position integer not null default 0
);
alter table public.catalog_items enable row level security;
grant select on public.catalog_items to anon,authenticated;
grant insert,update,delete on public.catalog_items to authenticated;
create policy "public can read visible catalog" on public.catalog_items
 for select to anon,authenticated using (
  enabled or exists(select 1 from public.admin_users a where a.user_id = (select auth.uid()))
 );
create policy "admin insert" on public.catalog_items for insert to authenticated
 with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy "admin update" on public.catalog_items for update to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
 with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy "admin delete" on public.catalog_items for delete to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

insert into public.catalog_items(id,category,title,subtitle,measure,presentation,packages,bags_per_roll,units_per_box,price_pickup,price_delivery,featured,position)
values
('cam-32','camiseta','Bolsas camiseta','Línea verde · Más que premium','32 × 40','Bulto',20,null,null,null,null,false,10),
('cam-40','camiseta','Bolsas camiseta','Línea verde · Más que premium','40 × 50','Bulto',20,null,null,null,null,false,11),
('cam-45','camiseta','Bolsas camiseta','Línea verde · Más que premium','45 × 60','Bulto',20,null,null,null,null,false,12),
('arr-15-20','arranque','Bolsas de arranque','Para comercios y verdulerías','15 × 20','Bulto',null,null,null,null,null,false,20),
('arr-15-25','arranque','Bolsas de arranque','Para comercios y verdulerías','15 × 25','Bulto',null,null,null,null,null,false,21),
('arr-20-30','arranque','Bolsas de arranque','Para comercios y verdulerías','20 × 30','Bulto',null,null,null,null,null,false,22),
('arr-25-35','arranque','Bolsas de arranque','Para comercios y verdulerías','25 × 35','Bulto',null,null,null,null,null,false,23),
('arr-30-40','arranque','Bolsas de arranque','Para comercios y verdulerías','30 × 40','Bulto',null,null,null,null,null,false,24),
('res-45','residuos','Bolsas de basura','En rollito fondo estrella y en paquete · Residuos','45 × 60','Bulto',null,null,null,null,null,false,30),
('res-50','residuos','Bolsas de basura','En rollito fondo estrella y en paquete · Residuos','50 × 70','Bulto',null,null,null,null,null,false,31),
('fol-14','folex','Folex','Presentaciones mayoristas','14 × 14','Bulto',null,null,null,null,null,false,40),
('fol-28','folex','Folex','Presentaciones mayoristas','14 × 28','Bulto',null,null,null,null,null,false,41),
('fol-20','folex','Folex','Presentaciones mayoristas','20 × 25','Bulto',null,null,null,null,null,false,42),
('film-otros','film','Film adherente','Para cajones de frutas y verduras','Medidas a consultar','Consultar',null,null,null,null,null,false,50),
('muns-45','munsmawa','Film verdulero Munsmawa','Promoción semanal','45 cm × 350 m','Caja',null,null,9,46725,null,true,1)
on conflict (id) do nothing;
-- Autorizar TU usuario después de crearlo en Authentication > Users:
-- insert into public.admin_users(user_id)
-- select id from auth.users where lower(email)=lower('TU_CORREO');
-- El registro público en Supabase Auth debe estar DESACTIVADO.
