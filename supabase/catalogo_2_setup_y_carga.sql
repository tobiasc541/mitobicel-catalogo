-- MITOBICEL | Catálogo 2: completo para clientes habituales
-- Ejecutar una vez SOLO en el proyecto Supabase del catálogo MITOBICEL.
-- No modifica ni elimina registros de public.catalog_items, catalog_offers o admin_users.
-- Los dos catálogos pueden tener precios y presentaciones diferentes. 
-- Precio de lista separado de retiro y envío, para evitar asumir una modalidad de venta.

create table if not exists public.catalog_full_items (
  id text primary key,
  category text not null,
  title text not null,
  subtitle text not null default '',
  measure text not null,
  presentation text not null default 'Bulto',
  packages integer check (packages is null or packages >= 0),
  bags_per_roll integer check (bags_per_roll is null or bags_per_roll >= 0),
  units_per_box integer check (units_per_box is null or units_per_box >= 0),
  price_pickup numeric(14,2) check (price_pickup is null or price_pickup >= 0),
  price_delivery numeric(14,2) check (price_delivery is null or price_delivery >= 0),
  featured boolean not null default false,
  enabled boolean not null default true,
  image_url text,
  position integer not null default 0
);

create index if not exists catalog_full_items_category_position
  on public.catalog_full_items(category,position);

alter table public.catalog_full_items enable row level security;

-- Dar exclusivamente los permisos previstos.
revoke all on public.catalog_full_items from anon, authenticated;
grant select on public.catalog_full_items to anon, authenticated;
grant insert, update, delete on public.catalog_full_items to authenticated;

do $do$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='catalog_full_items' and policyname='full catalog public visible'
  ) then
    create policy "full catalog public visible"
      on public.catalog_full_items for select to anon
      using (enabled);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='catalog_full_items' and policyname='full catalog admin read'
  ) then
    create policy "full catalog admin read"
      on public.catalog_full_items for select to authenticated
      using (
        enabled or exists (
          select 1 from public.admin_users a where a.user_id=(select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='catalog_full_items' and policyname='full catalog admin insert'
  ) then
    create policy "full catalog admin insert"
      on public.catalog_full_items for insert to authenticated
      with check (
        exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()))
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='catalog_full_items' and policyname='full catalog admin update'
  ) then
    create policy "full catalog admin update"
      on public.catalog_full_items for update to authenticated
      using (
        exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()))
      )
      with check (
        exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()))
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='catalog_full_items' and policyname='full catalog admin delete'
  ) then
    create policy "full catalog admin delete"
      on public.catalog_full_items for delete to authenticated
      using (
        exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()))
      );
  end if;
end $do$;

-- El Catálogo 2 se inicia exclusivamente con la lista completa Provincias; no se duplican los 15 productos del Catálogo 1.

-- Columnas adicionales de la lista completa (aditivo, compatible con tabla existente).
ALTER TABLE public.catalog_full_items
  ADD COLUMN IF NOT EXISTS price_list numeric(14,2) check (price_list is null or price_list >= 0),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS source_original_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS source_page integer,
  ADD COLUMN IF NOT EXISTS requires_quote boolean NOT NULL DEFAULT false;

-- Comprobación: no debe modificar la cantidad de registros del Catálogo 1.
select
  (select count(*) from public.catalog_items) as catalogo_1_original,
  (select count(*) from public.catalog_full_items) as catalogo_2_independiente;

-- MITOBICEL Catálogo 2 · Lista Provincias 26-10-2026 · 176 presentaciones
-- Unicamente catalog_full_items. NO modificar catálogo público del QR.
-- ARS: 144 precios mayoristas por presentacion -$4.000; 14 precios por kilo/unidad/paquete se mantienen originales.
-- USD: 18 precios se preservan sin conversion.
-- Ingreso idempotente; precios personalizados no son sobrescritos.
BEGIN;
INSERT INTO public.catalog_full_items (id,category,title,subtitle,measure,presentation,packages,bags_per_roll,units_per_box,price_pickup,price_delivery,price_list,currency,source_original_price,source_page,requires_quote,featured,enabled,image_url,position) VALUES
('prov26-001','cat2-01-film-munsmawa','Film Munsmawa','FILM ADHERENTE / ALIMENTICIO','45 cm · código 350','Caja · 9 unidades/caja · nuevo packaging',NULL,NULL,NULL,NULL,NULL,51500,'ARS',55500,2,false,false,true,NULL,1),
('prov26-002','cat2-01-film-munsmawa','Film Munsmawa','FILM ADHERENTE / ALIMENTICIO','45 cm · código 350','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,61560,'ARS',65560,4,false,false,true,NULL,2),
('prov26-003','cat2-02-film-therma-pro','Film Therma Pro','FILM ADHERENTE / ALIMENTICIO','30 cm · código 300','Bulto · 12 unidades/bulto',NULL,NULL,NULL,NULL,NULL,30000,'ARS',34000,3,false,false,true,NULL,3),
('prov26-004','cat2-03-film-30-cm','Film 30 cm','FILM ADHERENTE / ALIMENTICIO','30 cm × 30 mts.','Bulto · 21 unidades/bulto',NULL,NULL,NULL,NULL,NULL,20050,'ARS',24050,5,false,false,true,NULL,4),
('prov26-005','cat2-03-film-30-cm','Film 30 cm','FILM ADHERENTE / ALIMENTICIO','30 cm · código 200','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,25750,'ARS',29750,6,false,false,true,NULL,5),
('prov26-006','cat2-03-film-30-cm','Film 30 cm','FILM ADHERENTE / ALIMENTICIO','30 cm · código 350','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,44850,'ARS',48850,6,false,false,true,NULL,6),
('prov26-007','cat2-03-film-30-cm','Film 30 cm','FILM ADHERENTE / ALIMENTICIO','30 cm · código 800','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,60700,'ARS',64700,7,false,false,true,NULL,7),
('prov26-008','cat2-03-film-30-cm','Film 30 cm','FILM ADHERENTE / ALIMENTICIO','30 cm · código 1000','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,72500,'ARS',76500,7,false,false,true,NULL,8),
('prov26-009','cat2-04-film-38-cm','Film 38 cm','FILM ADHERENTE / ALIMENTICIO','38 cm · código 200','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,30750,'ARS',34750,8,false,false,true,NULL,9),
('prov26-010','cat2-04-film-38-cm','Film 38 cm','FILM ADHERENTE / ALIMENTICIO','38 cm · código 350','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,55500,'ARS',59500,8,false,false,true,NULL,10),
('prov26-011','cat2-04-film-38-cm','Film 38 cm','FILM ADHERENTE / ALIMENTICIO','38 cm · código 800','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,74900,'ARS',78900,9,false,false,true,NULL,11),
('prov26-012','cat2-04-film-38-cm','Film 38 cm','FILM ADHERENTE / ALIMENTICIO','38 cm · código 1000','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,90900,'ARS',94900,9,false,false,true,NULL,12),
('prov26-013','cat2-05-film-45-cm','Film 45 cm','FILM ADHERENTE / ALIMENTICIO','45 cm · código 350','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,61560,'ARS',65560,10,false,false,true,NULL,13),
('prov26-014','cat2-05-film-45-cm','Film 45 cm','FILM ADHERENTE / ALIMENTICIO','45 cm · código 800','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,87700,'ARS',91700,10,false,false,true,NULL,14),
('prov26-015','cat2-05-film-45-cm','Film 45 cm','FILM ADHERENTE / ALIMENTICIO','45 cm · código 1000','Bulto · 6 unidades/bulto',NULL,NULL,NULL,NULL,NULL,104900,'ARS',108900,11,false,false,true,NULL,15),
('prov26-016','cat2-06-mitobicel-verde-mas-que-premium-gofrada-alta-densida','MITOBICEL verde más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','32×40','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,15500,'ARS',19500,12,false,false,true,NULL,16),
('prov26-017','cat2-06-mitobicel-verde-mas-que-premium-gofrada-alta-densida','MITOBICEL verde más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19000,'ARS',23000,12,false,false,true,NULL,17),
('prov26-018','cat2-06-mitobicel-verde-mas-que-premium-gofrada-alta-densida','MITOBICEL verde más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','45×60','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,30000,'ARS',34000,12,false,false,true,NULL,18),
('prov26-019','cat2-06-mitobicel-verde-mas-que-premium-gofrada-alta-densida','MITOBICEL verde más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 100 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19000,'ARS',23000,13,false,false,true,NULL,19),
('prov26-020','cat2-06-mitobicel-verde-mas-que-premium-gofrada-alta-densida','MITOBICEL verde más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 58–65 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,22800,'ARS',26800,13,false,false,true,NULL,20),
('prov26-021','cat2-07-mitobicel-black-mas-que-premium-gofrada-alta-densida','MITOBICEL Black más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','32×40','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,15500,'ARS',19500,14,false,false,true,NULL,21),
('prov26-022','cat2-07-mitobicel-black-mas-que-premium-gofrada-alta-densida','MITOBICEL Black más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','45×60','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,30000,'ARS',34000,14,false,false,true,NULL,22),
('prov26-023','cat2-08-mitobicel-violeta-mas-que-premium-gofrada-alta-densi','MITOBICEL violeta más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 45–50 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19000,'ARS',23000,15,false,false,true,NULL,23),
('prov26-024','cat2-09-mitobicel-negra-mas-que-premium-gofrada-alta-densida','MITOBICEL negra más que premium gofrada (alta densidad con lineal)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 45–50 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19000,'ARS',23000,16,false,false,true,NULL,24),
('prov26-025','cat2-10-mitobicel-blue-mas-que-premium-gofrada-la-imagen-dic','MITOBICEL Blue más que premium gofrada (la imagen dice Blue; texto incrustado dice Negra)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 45–50 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19000,'ARS',23000,17,false,false,true,NULL,25),
('prov26-026','cat2-11-mitobicel-verde-mas-que-premium-gofrada-imagen-pagin','MITOBICEL verde más que premium gofrada (imagen, página sin texto extraíble)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 45–50 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,17900,'ARS',21900,18,false,false,true,NULL,26),
('prov26-027','cat2-12-camiseta-gofrada-linea-virgen-biodegradable-alta-den','Camiseta gofrada línea virgen biodegradable (alta densidad con lineal y master; azul/verde/blanca/violeta)','BOLSAS CAMISETA','32×40','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,16500,'ARS',20500,19,false,false,true,NULL,27),
('prov26-028','cat2-12-camiseta-gofrada-linea-virgen-biodegradable-alta-den','Camiseta gofrada línea virgen biodegradable (alta densidad con lineal y master; azul/verde/blanca/violeta)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,22500,'ARS',26500,20,false,false,true,NULL,28),
('prov26-029','cat2-12-camiseta-gofrada-linea-virgen-biodegradable-alta-den','Camiseta gofrada línea virgen biodegradable (alta densidad con lineal y master; azul/verde/blanca/violeta)','BOLSAS CAMISETA','45×60','Bulto · 10 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,18000,'ARS',22000,21,false,false,true,NULL,29),
('prov26-030','cat2-12-camiseta-gofrada-linea-virgen-biodegradable-alta-den','Camiseta gofrada línea virgen biodegradable (alta densidad con lineal y master; azul/verde/blanca/violeta)','BOLSAS CAMISETA','45×60','Bulto · 20 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,35100,'ARS',39100,21,false,false,true,NULL,30),
('prov26-031','cat2-12-camiseta-gofrada-linea-virgen-biodegradable-alta-den','Camiseta gofrada línea virgen biodegradable (alta densidad con lineal y master; azul/verde/blanca/violeta)','BOLSAS CAMISETA','50×70','Bulto · 10 paquetes · 48–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,24400,'ARS',28400,22,false,false,true,NULL,31),
('prov26-032','cat2-13-camiseta-blanca-funda-amarilla-alta-densidad-para-pa','Camiseta blanca funda amarilla (alta densidad, para panadería, almacén, carnicería)','BOLSAS CAMISETA','32×40','Bulto · 20 paquetes · 50–52 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,17100,'ARS',21100,23,false,false,true,NULL,32),
('prov26-033','cat2-14-camiseta-blanca-funda-naranja-alta-densidad-panaderi','Camiseta blanca funda naranja (alta densidad, panadería)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 50–52 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,24000,'ARS',28000,24,false,false,true,NULL,33),
('prov26-034','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','32×40','Bulto · 20 paquetes · 50–52 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,15500,'ARS',19500,25,false,false,true,NULL,34),
('prov26-035','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 50–52 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,20700,'ARS',24700,25,false,false,true,NULL,35),
('prov26-036','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','45×60','Bulto · 20 paquetes · 50–52 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,32500,'ARS',36500,25,false,false,true,NULL,36),
('prov26-037','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','50×60','Bulto · 10 paquetes · 55 bolsas/paquete aprox. · 5 kg/bulto aprox.',NULL,NULL,NULL,NULL,NULL,27450,'ARS',31450,26,false,false,true,NULL,37),
('prov26-038','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','50×70','Bulto · 10 paquetes · 55 bolsas/paquete aprox. · 5 kg/bulto aprox.',NULL,NULL,NULL,NULL,NULL,30750,'ARS',34750,26,false,false,true,NULL,38),
('prov26-039','cat2-15-camiseta-verde-virgen-reforzada-alta-densidad','Camiseta verde virgen reforzada (alta densidad)','BOLSAS CAMISETA','60×80','Bulto · 5 paquetes · 60 bolsas/paquete aprox. · 4,2 kg/bulto aprox.',NULL,NULL,NULL,NULL,NULL,25700,'ARS',29700,26,false,false,true,NULL,39),
('prov26-040','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','30×40','Bulto · 20 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,19200,'ARS',23200,27,false,false,true,NULL,40),
('prov26-041','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,28050,'ARS',32050,27,false,false,true,NULL,41),
('prov26-042','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','45×60','Bulto · 10 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,26400,'ARS',30400,28,false,false,true,NULL,42),
('prov26-043','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','45×60','Bulto · 20 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,50700,'ARS',54700,28,false,false,true,NULL,43),
('prov26-044','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','50×60','Bulto · 10 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,28050,'ARS',32050,28,false,false,true,NULL,44),
('prov26-045','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','50×70','Bulto · 10 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,36950,'ARS',40950,29,false,false,true,NULL,45),
('prov26-046','cat2-16-camiseta-blanca-reforzada-media-densidad','Camiseta blanca reforzada (media densidad)','BOLSAS CAMISETA','60×80','Bulto · 5 paquetes · 50–55 bolsas/paquete aprox.',NULL,NULL,NULL,NULL,NULL,31000,'ARS',35000,29,false,false,true,NULL,46),
('prov26-047','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','32×40','Bulto · 10 paquetes · 60 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,13000,'ARS',17000,30,false,false,true,NULL,47),
('prov26-048','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 50 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,13500,'ARS',17500,30,false,false,true,NULL,48),
('prov26-049','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 20 paquetes · 50 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,25950,'ARS',29950,31,false,false,true,NULL,49),
('prov26-050','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 100 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,25950,'ARS',29950,31,false,false,true,NULL,50),
('prov26-051','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','45×60','Bulto · 10 paquetes · 60 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,21950,'ARS',25950,32,false,false,true,NULL,51),
('prov26-052','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','50×70','Bulto · 10 paquetes · 60 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,37850,'ARS',41850,32,false,false,true,NULL,52),
('prov26-053','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','60×80','Bulto · 300 bolsas/bulto · paquetes sin especificar',NULL,NULL,NULL,NULL,NULL,31500,'ARS',35500,33,false,false,true,NULL,53),
('prov26-054','cat2-17-camiseta-doble-uso-mas-que-premium-materia-prima-sil','Camiseta doble uso «más que premium» (materia prima silo bolsa)','BOLSAS CAMISETA','80×100','Bulto · 100 bolsas/bulto · paquetes sin especificar',NULL,NULL,NULL,NULL,NULL,17800,'ARS',21800,33,false,false,true,NULL,54),
('prov26-055','cat2-18-camiseta-a-granel-doble-uso-mas-que-premium-silo-bol','Camiseta a granel doble uso «más que premium» (silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 50 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,13000,'ARS',17000,34,false,false,true,NULL,55),
('prov26-056','cat2-18-camiseta-a-granel-doble-uso-mas-que-premium-silo-bol','Camiseta a granel doble uso «más que premium» (silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 60 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,15400,'ARS',19400,34,false,false,true,NULL,56),
('prov26-057','cat2-18-camiseta-a-granel-doble-uso-mas-que-premium-silo-bol','Camiseta a granel doble uso «más que premium» (silo bolsa)','BOLSAS CAMISETA','40×50','Bulto · 10 paquetes · 100 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,25500,'ARS',29500,34,false,false,true,NULL,57),
('prov26-058','cat2-19-laminas-separador-mi-tobicel-etiqueta-azul-alta-dens','Láminas separador mi Tobicel, etiqueta azul (alta densidad / material virgen)','LÁMINAS SEPARADOR / FOLEX','20×25','Bulto · 10 paquetes · 8 kg/bulto',NULL,NULL,NULL,NULL,NULL,50600,'ARS',54600,35,false,false,true,NULL,58),
('prov26-059','cat2-19-laminas-separador-mi-tobicel-etiqueta-azul-alta-dens','Láminas separador mi Tobicel, etiqueta azul (alta densidad / material virgen)','LÁMINAS SEPARADOR / FOLEX','25×37','Bulto · 10 paquetes · 8 kg/bulto',NULL,NULL,NULL,NULL,NULL,50600,'ARS',54600,35,false,false,true,NULL,59),
('prov26-060','cat2-19-laminas-separador-mi-tobicel-etiqueta-azul-alta-dens','Láminas separador mi Tobicel, etiqueta azul (alta densidad / material virgen)','LÁMINAS SEPARADOR / FOLEX','14×14','Bulto · 8 kg/bulto · paquetes no informados',NULL,NULL,NULL,NULL,NULL,64300,'ARS',68300,36,false,false,true,NULL,60),
('prov26-061','cat2-19-laminas-separador-mi-tobicel-etiqueta-azul-alta-dens','Láminas separador mi Tobicel, etiqueta azul (alta densidad / material virgen)','LÁMINAS SEPARADOR / FOLEX','14×28','Bulto · 8 kg/bulto · paquetes no informados',NULL,NULL,NULL,NULL,NULL,56900,'ARS',60900,36,false,false,true,NULL,61),
('prov26-062','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','15×20','Bulto · 12 rollos · 310 g/rollo',NULL,NULL,NULL,NULL,NULL,28900,'ARS',32900,37,false,false,true,NULL,62),
('prov26-063','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','15×25','Bulto · 12 rollos · 390 g/rollo',NULL,NULL,NULL,NULL,NULL,36500,'ARS',40500,37,false,false,true,NULL,63),
('prov26-064','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','20×30','Bulto · 12 rollos · 600 g/rollo',NULL,NULL,NULL,NULL,NULL,43800,'ARS',47800,38,false,false,true,NULL,64),
('prov26-065','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','25×35','Bulto · 9 rollos · 800 g/rollo',NULL,NULL,NULL,NULL,NULL,45250,'ARS',49250,38,false,false,true,NULL,65),
('prov26-066','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','30×40','Bulto · 6 rollos · 1.000 g/rollo',NULL,NULL,NULL,NULL,NULL,39700,'ARS',43700,38,false,false,true,NULL,66),
('prov26-067','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','35×45','Bulto · 9 rollos · 800 g/rollo',NULL,NULL,NULL,NULL,NULL,45250,'ARS',49250,38,false,false,true,NULL,67),
('prov26-068','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','40×50','Bulto · 6 rollos · 900 g/rollo',NULL,NULL,NULL,NULL,NULL,34900,'ARS',38900,39,false,false,true,NULL,68),
('prov26-069','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','45×60','Bulto · 6 rollos · 1.250 g/rollo',NULL,NULL,NULL,NULL,NULL,49200,'ARS',53200,39,false,false,true,NULL,69),
('prov26-070','cat2-20-arranque-titan-rendidor','Arranque Titan rendidor','ROLLOS DE ARRANQUE','50×70','Bulto · 6 rollos · 1.500 g/rollo',NULL,NULL,NULL,NULL,NULL,58700,'ARS',62700,39,false,false,true,NULL,70),
('prov26-071','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','20×30','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,40,false,false,true,NULL,71),
('prov26-072','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','25×35','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,40,false,false,true,NULL,72),
('prov26-073','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','30×40','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,40,false,false,true,NULL,73),
('prov26-074','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','35×45','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,41,false,false,true,NULL,74),
('prov26-075','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','40×50','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,41,false,false,true,NULL,75),
('prov26-076','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','45×60','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,41,false,false,true,NULL,76),
('prov26-077','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','50×70','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,42,false,false,true,NULL,77),
('prov26-078','cat2-21-arranque-funda-verde-alta-densidad-1-200-kg-rollo-se','Arranque funda verde alta densidad (1,200 kg/rollo según PDF)','ROLLOS DE ARRANQUE','60×90','Bulto · 6 rollos · 1,200 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,41900,'ARS',45900,42,false,false,true,NULL,78),
('prov26-079','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','20×30','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,43,false,false,true,NULL,79),
('prov26-080','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','25×35','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,43,false,false,true,NULL,80),
('prov26-081','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','30×40','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,43,false,false,true,NULL,81),
('prov26-082','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','35×45','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,44,false,false,true,NULL,82),
('prov26-083','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','40×50','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,44,false,false,true,NULL,83),
('prov26-084','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','45×60','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,44,false,false,true,NULL,84),
('prov26-085','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','50×70','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,45,false,false,true,NULL,85),
('prov26-086','cat2-22-arranque-funda-celeste-alta-densidad-1-500-kg-rollo-','Arranque funda celeste alta densidad (1,500 kg/rollo según PDF)','ROLLOS DE ARRANQUE','60×90','Bulto · 6 rollos · 1,500 kg/rollo según PDF',NULL,NULL,NULL,NULL,NULL,55400,'ARS',59400,45,false,false,true,NULL,86),
('prov26-087','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','15×20','Bulto · 12 rollos · 280 g/rollo',NULL,NULL,NULL,NULL,NULL,25600,'ARS',29600,46,false,false,true,NULL,87),
('prov26-088','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','15×25','Bulto · 12 rollos · 290 g/rollo',NULL,NULL,NULL,NULL,NULL,27000,'ARS',31000,46,false,false,true,NULL,88),
('prov26-089','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','20×30','Bulto · 12 rollos · 500 g/rollo',NULL,NULL,NULL,NULL,NULL,41200,'ARS',45200,47,false,false,true,NULL,89),
('prov26-090','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','25×35','Bulto · 9 rollos · 700 g/rollo',NULL,NULL,NULL,NULL,NULL,39850,'ARS',43850,47,false,false,true,NULL,90),
('prov26-091','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','30×40','Bulto · 6 rollos · 850 g/rollo',NULL,NULL,NULL,NULL,NULL,36050,'ARS',40050,48,false,false,true,NULL,91),
('prov26-092','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','35×45','Bulto · 9 rollos · 750 g/rollo',NULL,NULL,NULL,NULL,NULL,39850,'ARS',43850,48,false,false,true,NULL,92),
('prov26-093','cat2-23-arranque-forte','Arranque Forte','ROLLOS DE ARRANQUE','40×50','Bulto · 6 rollos · 800 g/rollo',NULL,NULL,NULL,NULL,NULL,30900,'ARS',34900,48,false,false,true,NULL,93),
('prov26-094','cat2-24-bolsas-para-residuo-linea-liviana','Bolsas para residuo, línea liviana','RESIDUO Y CONSORCIO EN PAQUETE','45×60','Bulto · 100 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,43600,'ARS',47600,49,false,false,true,NULL,94),
('prov26-095','cat2-24-bolsas-para-residuo-linea-liviana','Bolsas para residuo, línea liviana','RESIDUO Y CONSORCIO EN PAQUETE','50×70','Bulto · 100 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,49650,'ARS',53650,49,false,false,true,NULL,95),
('prov26-096','cat2-25-bolsas-para-consorcio-linea-liviana','Bolsas para consorcio, línea liviana','RESIDUO Y CONSORCIO EN PAQUETE','60×90','Bulto · 50 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,32300,'ARS',36300,50,false,false,true,NULL,96),
('prov26-097','cat2-25-bolsas-para-consorcio-linea-liviana','Bolsas para consorcio, línea liviana','RESIDUO Y CONSORCIO EN PAQUETE','80×110','Bulto · 20 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,24600,'ARS',28600,50,false,false,true,NULL,97),
('prov26-098','cat2-25-bolsas-para-consorcio-linea-liviana','Bolsas para consorcio, línea liviana','RESIDUO Y CONSORCIO EN PAQUETE','90×120','Bulto · 20 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,28600,'ARS',32600,50,false,false,true,NULL,98),
('prov26-099','cat2-26-bolsas-para-residuo-linea-premium','Bolsas para residuo, línea premium','RESIDUO Y CONSORCIO EN PAQUETE','45×60','Bulto · 100 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,49300,'ARS',53300,51,false,false,true,NULL,99),
('prov26-100','cat2-26-bolsas-para-residuo-linea-premium','Bolsas para residuo, línea premium','RESIDUO Y CONSORCIO EN PAQUETE','50×70','Bulto · 50 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,35600,'ARS',39600,51,false,false,true,NULL,100),
('prov26-101','cat2-27-bolsas-para-consorcio-linea-premium','Bolsas para consorcio, línea premium','RESIDUO Y CONSORCIO EN PAQUETE','60×90','Bulto · 50 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,58100,'ARS',62100,52,false,false,true,NULL,101),
('prov26-102','cat2-27-bolsas-para-consorcio-linea-premium','Bolsas para consorcio, línea premium','RESIDUO Y CONSORCIO EN PAQUETE','80×110','Bulto · 20 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,40850,'ARS',44850,52,false,false,true,NULL,102),
('prov26-103','cat2-27-bolsas-para-consorcio-linea-premium','Bolsas para consorcio, línea premium','RESIDUO Y CONSORCIO EN PAQUETE','90×120','Bulto · 20 paquetes · 10 bolsas/paquete',NULL,NULL,NULL,NULL,NULL,49650,'ARS',53650,52,false,false,true,NULL,103),
('prov26-104','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','37×30','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,21.23,'USD',21.23,53,false,false,true,NULL,104),
('prov26-105','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','44×50','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,37.6,'USD',37.6,53,false,false,true,NULL,105),
('prov26-106','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','57×20','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,21.23,'USD',21.23,53,false,false,true,NULL,106),
('prov26-107','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','57×30','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,30.44,'USD',30.44,54,false,false,true,NULL,107),
('prov26-108','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','80×30','Bulto · 50 unidades/bulto',NULL,NULL,NULL,NULL,NULL,21.75,'USD',21.75,54,false,false,true,NULL,108),
('prov26-109','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','80×50','Bulto · 50 unidades/bulto',NULL,NULL,NULL,NULL,NULL,33,'USD',33,54,false,false,true,NULL,109),
('prov26-110','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','80×60','Bulto · 50 unidades/bulto',NULL,NULL,NULL,NULL,NULL,38.63,'USD',38.63,54,false,false,true,NULL,110),
('prov26-111','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','80×70','Bulto · 50 unidades/bulto',NULL,NULL,NULL,NULL,NULL,45.28,'USD',45.28,55,false,false,true,NULL,111),
('prov26-112','cat2-28-rollos-termicos','Rollos térmicos','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','80×80','Bulto · 50 unidades/bulto',NULL,NULL,NULL,NULL,NULL,50.9,'USD',50.9,55,false,false,true,NULL,112),
('prov26-113','cat2-29-rollo-papel-obra','Rollo papel obra','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','57×30','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,33.51,'USD',33.51,56,false,false,true,NULL,113),
('prov26-114','cat2-30-rollo-papel-duplicado-quimico','Rollo papel duplicado químico','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','76×30','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,18.17,'USD',18.17,56,false,false,true,NULL,114),
('prov26-115','cat2-30-rollo-papel-duplicado-quimico','Rollo papel duplicado químico','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','75×30','Bulto · 10 unidades/bulto',NULL,NULL,NULL,NULL,NULL,18.17,'USD',18.17,56,false,false,true,NULL,115),
('prov26-116','cat2-31-etiquetas-autoadhesivas-top','Etiquetas autoadhesivas TOP','ROLLOS TÉRMICOS, OBRA, QUÍMICO Y ETIQUETAS','55×44','Bulto · 80 rollos/bulto',NULL,NULL,NULL,NULL,NULL,75.42,'USD',75.42,57,false,false,true,NULL,116),
('prov26-117','cat2-32-cinta-confitera-cristal','Cinta confitera cristal','CINTAS DE EMBALAR Y CONFITERA','24 mm × 50 mts','Unidad · color cristal',NULL,NULL,NULL,NULL,NULL,365,'ARS',365,58,false,false,true,NULL,117),
('prov26-118','cat2-32-cinta-confitera-cristal','Cinta confitera cristal','CINTAS DE EMBALAR Y CONFITERA','24 mm × 50 mts','Bulto · 72 unidades/bulto · color cristal',NULL,NULL,NULL,NULL,NULL,23950,'ARS',27950,58,false,false,true,NULL,118),
('prov26-119','cat2-33-cinta-de-embalar-importada-cristal-48-mm-80-mts','Cinta de embalar importada cristal · 48 mm × 80 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 80 mts','Tubo · 6 unidades/tubo',NULL,NULL,NULL,NULL,NULL,2500,'ARS',6500,59,false,false,true,NULL,119),
('prov26-120','cat2-33-cinta-de-embalar-importada-cristal-48-mm-80-mts','Cinta de embalar importada cristal · 48 mm × 80 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 80 mts','Bulto · 36 unidades/bulto',NULL,NULL,NULL,NULL,NULL,35000,'ARS',39000,59,false,false,true,NULL,120),
('prov26-121','cat2-33-cinta-de-embalar-importada-cristal-48-mm-80-mts','Cinta de embalar importada cristal · 48 mm × 80 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 80 mts','Tubo · 6 unidades/tubo',NULL,NULL,NULL,NULL,NULL,2200,'ARS',6200,60,false,false,true,NULL,121),
('prov26-122','cat2-33-cinta-de-embalar-importada-cristal-48-mm-80-mts','Cinta de embalar importada cristal · 48 mm × 80 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 80 mts','Bulto · 72 unidades/bulto',NULL,NULL,NULL,NULL,NULL,70000,'ARS',74000,60,false,false,true,NULL,122),
('prov26-123','cat2-34-cinta-de-embalar-cristal-48-mm-100-mts','Cinta de embalar cristal · 48 mm × 100 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 100 mts','Tubo · 6 unidades/tubo',NULL,NULL,NULL,NULL,NULL,5250,'ARS',9250,61,false,false,true,NULL,123),
('prov26-124','cat2-34-cinta-de-embalar-cristal-48-mm-100-mts','Cinta de embalar cristal · 48 mm × 100 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 100 mts','Bulto · 36 unidades/bulto',NULL,NULL,NULL,NULL,NULL,51400,'ARS',55400,61,false,false,true,NULL,124),
('prov26-125','cat2-34-cinta-de-embalar-cristal-48-mm-100-mts','Cinta de embalar cristal · 48 mm × 100 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 100 mts','Tubo · 6 unidades/tubo',NULL,NULL,NULL,NULL,NULL,5250,'ARS',9250,62,false,false,true,NULL,125),
('prov26-126','cat2-34-cinta-de-embalar-cristal-48-mm-100-mts','Cinta de embalar cristal · 48 mm × 100 mts','CINTAS DE EMBALAR Y CONFITERA','48 mm × 100 mts','Bulto · 72 unidades/bulto',NULL,NULL,NULL,NULL,NULL,102800,'ARS',106800,62,false,false,true,NULL,126),
('prov26-127','cat2-35-mtc-stretch-virgen-sin-mango-linea-liviana-cristal-y','MTC stretch virgen sin mango, línea liviana (cristal y negro)','STRETCH FILM','50 cm','Precio por kg · 4 unidades/bulto · 13,6 kg aprox./bulto',NULL,NULL,NULL,NULL,NULL,2.53,'USD',2.53,63,false,false,true,NULL,127),
('prov26-128','cat2-36-stretch-virgen-para-embalar-10-cm-cristal','Stretch virgen para embalar 10 cm · cristal','STRETCH FILM','10 cm','Bulto · 45 unidades/bulto',NULL,NULL,NULL,NULL,NULL,48.59,'USD',48.59,64,false,false,true,NULL,128),
('prov26-129','cat2-36-stretch-virgen-para-embalar-10-cm-cristal','Stretch virgen para embalar 10 cm · cristal','STRETCH FILM','10 cm','Unidad · presentación suelta',NULL,NULL,NULL,NULL,NULL,1.08,'USD',1.08,64,false,false,true,NULL,129),
('prov26-130','cat2-37-stretch-virgen-para-embalar-10-cm-negro','Stretch virgen para embalar 10 cm · negro','STRETCH FILM','10 cm','Bulto · 45 unidades/bulto',NULL,NULL,NULL,NULL,NULL,50.17,'USD',50.17,64,false,false,true,NULL,130),
('prov26-131','cat2-37-stretch-virgen-para-embalar-10-cm-negro','Stretch virgen para embalar 10 cm · negro','STRETCH FILM','10 cm','Unidad · presentación suelta',NULL,NULL,NULL,NULL,NULL,1.13,'USD',1.13,64,false,false,true,NULL,131),
('prov26-132','cat2-38-papel-diario-importado-para-fiambres-facturas-etc','Papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','35×45','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,65,false,false,true,NULL,132),
('prov26-133','cat2-38-papel-diario-importado-para-fiambres-facturas-etc','Papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','40×50','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,65,false,false,true,NULL,133),
('prov26-134','cat2-38-papel-diario-importado-para-fiambres-facturas-etc','Papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','45×60','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,65,false,false,true,NULL,134),
('prov26-135','cat2-38-papel-diario-importado-para-fiambres-facturas-etc','Papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','50×70','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,65,false,false,true,NULL,135),
('prov26-136','cat2-38-papel-diario-importado-para-fiambres-facturas-etc','Papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','60×90','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,65,false,false,true,NULL,136),
('prov26-137','cat2-39-bobina-papel-diario-importado-para-fiambres-facturas','Bobina papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','40 cm','Precio por kg · aprox. 8 kg/bobina',NULL,NULL,NULL,NULL,NULL,2870,'ARS',2870,66,false,false,true,NULL,137),
('prov26-138','cat2-39-bobina-papel-diario-importado-para-fiambres-facturas','Bobina papel diario importado (para fiambres, facturas, etc.)','PAPEL DIARIO Y BOBINAS','60 cm','Precio por kg · aprox. 12 kg/bobina',NULL,NULL,NULL,NULL,NULL,2870,'ARS',2870,66,false,false,true,NULL,138),
('prov26-139','cat2-40-bobina-papel-diario-extrafino-brown','Bobina papel diario extrafino Brown','PAPEL DIARIO Y BOBINAS','60 cm','Precio por kg · aprox. 7,5 kg/bobina',NULL,NULL,NULL,NULL,NULL,2550,'ARS',2550,67,false,false,true,NULL,139),
('prov26-140','cat2-41-fondo-de-pizza-de-papel-diario','Fondo de pizza de papel diario','PAPEL DIARIO Y BOBINAS','30×30','Bulto · 10 kg/bulto',NULL,NULL,NULL,NULL,NULL,24700,'ARS',28700,68,false,false,true,NULL,140),
('prov26-141','cat2-42-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en caja','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','45×60','Caja · 24 rollos/caja · 20 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,13600,'ARS',17600,69,false,false,true,NULL,141),
('prov26-142','cat2-42-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en caja','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','50×70','Caja · 24 rollos/caja · 20 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,17050,'ARS',21050,69,false,false,true,NULL,142),
('prov26-143','cat2-43-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en caja','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','60×90','Caja · 24 rollos/caja · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,17300,'ARS',21300,70,false,false,true,NULL,143),
('prov26-144','cat2-43-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en caja','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','80×100','Caja · 20 rollos/caja · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,21800,'ARS',25800,70,false,false,true,NULL,144),
('prov26-145','cat2-43-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en caja','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','80×110','Bulto · 20 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,22700,'ARS',26700,70,false,false,true,NULL,145),
('prov26-146','cat2-44-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','45×60','Bulto · 24 rollos/bulto · 20 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,13200,'ARS',17200,71,false,false,true,NULL,146),
('prov26-147','cat2-44-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','50×70','Bulto · 24 rollos/bulto · 20 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,16650,'ARS',20650,71,false,false,true,NULL,147),
('prov26-148','cat2-44-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','50×70','Bulto · 40 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,16800,'ARS',20800,72,false,false,true,NULL,148),
('prov26-149','cat2-44-bolsas-de-residuo-mitobicel-en-rollitos-fondo-estrel','Bolsas de residuo MITOBICEL en rollitos fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','50×70','Bulto · 24 rollos/bulto · 15 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,13950,'ARS',17950,72,false,false,true,NULL,149),
('prov26-150','cat2-45-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','60×90','Bulto · 24 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,16900,'ARS',20900,73,false,false,true,NULL,150),
('prov26-151','cat2-45-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','80×100','Bulto · 20 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,21400,'ARS',25400,73,false,false,true,NULL,151),
('prov26-152','cat2-45-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','60×90 línea liviana','Bulto · 24 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,12100,'ARS',16100,73,false,false,true,NULL,152),
('prov26-153','cat2-45-bolsas-de-consorcio-mitobicel-en-rollito-fondo-estre','Bolsas de consorcio MITOBICEL en rollito fondo estrella en bulto','ROLLO FONDO ESTRELLA — RESIDUO/CONSORCIO','80×110','Caja (así figura el precio) · 20 rollos/bulto · 10 bolsas/rollo',NULL,NULL,NULL,NULL,NULL,22300,'ARS',26300,73,false,false,true,NULL,153),
('prov26-154','cat2-46-resmas-de-papel-alcalino-hp','Resmas de papel alcalino HP','PAPEL A4, ESCOMBROS Y SERVILLETAS','A4 · 21×29,7 cm · 75 g','Caja · 10 resmas/caja',NULL,NULL,NULL,NULL,NULL,58950,'ARS',62950,74,false,false,true,NULL,154),
('prov26-155','cat2-47-bolsas-de-escombro-a-granel','Bolsas de escombro a granel','PAPEL A4, ESCOMBROS Y SERVILLETAS','50×70 · 110 micrones','Bulto · 100 unidades/bulto',NULL,NULL,NULL,NULL,NULL,20600,'ARS',24600,75,false,false,true,NULL,155),
('prov26-156','cat2-47-bolsas-de-escombro-a-granel','Bolsas de escombro a granel','PAPEL A4, ESCOMBROS Y SERVILLETAS','50×70 · 110 micrones','Paquete · 10 bolsas a granel',NULL,NULL,NULL,NULL,NULL,2700,'ARS',2700,75,false,false,true,NULL,156),
('prov26-157','cat2-48-servilletas-new-pel-papel-alcalino-tissue-extra-suav','Servilletas NEW PEL, papel alcalino tissue extra suave','PAPEL A4, ESCOMBROS Y SERVILLETAS','33×33 cm','Caja · 1.000 unidades/caja · peso 1,680 kg',NULL,NULL,NULL,NULL,NULL,7500,'ARS',11500,76,false,false,true,NULL,157),
('prov26-158','cat2-49-servilletas-alumax-papel-alcalino-tissue-extra-suave','Servilletas ALUMAX, papel alcalino tissue extra suave','PAPEL A4, ESCOMBROS Y SERVILLETAS','33×33 cm','Caja · 500 unidades/caja · peso 920 g',NULL,NULL,NULL,NULL,NULL,6500,'ARS',10500,77,false,false,true,NULL,158),
('prov26-159','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','6×4 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,2600,'ARS',6600,78,false,false,true,NULL,159),
('prov26-160','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','6×8 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,3800,'ARS',7800,78,false,false,true,NULL,160),
('prov26-161','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','7×9 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,4100,'ARS',8100,78,false,false,true,NULL,161),
('prov26-162','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','8×11 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,5750,'ARS',9750,78,false,false,true,NULL,162),
('prov26-163','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','10×13 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,8450,'ARS',12450,78,false,false,true,NULL,163),
('prov26-164','cat2-50-carteles-estallidos-atado-10-paquetes-20-unidades','Carteles estallidos · atado 10 paquetes × 20 unidades','CARTELES ESTALLIDOS','11×16 cm','Bulto/atado · 200 unidades · 10 paquetes × 20 unidades',NULL,NULL,NULL,NULL,NULL,11450,'ARS',15450,78,false,false,true,NULL,164),
('prov26-165','cat2-51-carteles-estallidos-atado-10-paquetes-10-unidades','Carteles estallidos · atado 10 paquetes × 10 unidades','CARTELES ESTALLIDOS','16×22 cm','Bulto/atado · 100 unidades · 10 paquetes × 10 unidades',NULL,NULL,NULL,NULL,NULL,11450,'ARS',15450,79,false,false,true,NULL,165),
('prov26-166','cat2-51-carteles-estallidos-atado-10-paquetes-10-unidades','Carteles estallidos · atado 10 paquetes × 10 unidades','CARTELES ESTALLIDOS','20×30 cm','Bulto/atado · 100 unidades · 10 paquetes × 10 unidades',NULL,NULL,NULL,NULL,NULL,19500,'ARS',23500,79,false,false,true,NULL,166),
('prov26-167','cat2-51-carteles-estallidos-atado-10-paquetes-10-unidades','Carteles estallidos · atado 10 paquetes × 10 unidades','CARTELES ESTALLIDOS','24×32 cm','Bulto/atado · 100 unidades · 10 paquetes × 10 unidades',NULL,NULL,NULL,NULL,NULL,25000,'ARS',29000,79,false,false,true,NULL,167),
('prov26-168','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','6×4 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,300,'ARS',300,80,false,false,true,NULL,168),
('prov26-169','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','6×8 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,400,'ARS',400,80,false,false,true,NULL,169),
('prov26-170','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','7×9 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,450,'ARS',450,80,false,false,true,NULL,170),
('prov26-171','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','8×11 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,650,'ARS',650,80,false,false,true,NULL,171),
('prov26-172','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','10×13 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,950,'ARS',950,80,false,false,true,NULL,172),
('prov26-173','cat2-52-carteles-estallidos-paquete-suelto-20-unidades','Carteles estallidos · paquete suelto 20 unidades','CARTELES ESTALLIDOS','11×16 cm','Paquete · 20 unidades',NULL,NULL,NULL,NULL,NULL,1250,'ARS',1250,80,false,false,true,NULL,173),
('prov26-174','cat2-53-carteles-estallidos-paquete-suelto-10-unidades','Carteles estallidos · paquete suelto 10 unidades','CARTELES ESTALLIDOS','16×22 cm','Paquete · 10 unidades',NULL,NULL,NULL,NULL,NULL,1250,'ARS',1250,81,false,false,true,NULL,174),
('prov26-175','cat2-53-carteles-estallidos-paquete-suelto-10-unidades','Carteles estallidos · paquete suelto 10 unidades','CARTELES ESTALLIDOS','20×30 cm','Paquete · 10 unidades',NULL,NULL,NULL,NULL,NULL,2100,'ARS',2100,81,false,false,true,NULL,175),
('prov26-176','cat2-53-carteles-estallidos-paquete-suelto-10-unidades','Carteles estallidos · paquete suelto 10 unidades','CARTELES ESTALLIDOS','24×32 cm','Paquete · 10 unidades',NULL,NULL,NULL,NULL,NULL,2700,'ARS',2700,81,false,false,true,NULL,176)
ON CONFLICT (id) DO NOTHING;

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
SELECT count(*) AS catalogo_2_importados FROM public.catalog_full_items WHERE id LIKE 'prov26-%';
