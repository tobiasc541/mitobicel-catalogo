-- MITOBICEL | Catálogo 2: completo para clientes habituales
-- Ejecutar una vez SOLO en el proyecto Supabase del catálogo MITOBICEL.
-- No modifica ni elimina registros de public.catalog_items, catalog_offers o admin_users.
-- Los dos catálogos pueden tener precios y presentaciones diferentes.

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

-- Copiar UNA SOLA VEZ el catálogo base, incluidas fotos y precios,
-- para que el Catálogo 2 empiece con lo que ya existe.
-- Las futuras ediciones serán INDEPENDIENTES.
insert into public.catalog_full_items (
  id, category, title, subtitle, measure, presentation,
  packages, bags_per_roll, units_per_box, price_pickup,
  price_delivery, featured, enabled, image_url, position
)
select
  id, category, title, subtitle, measure, presentation,
  packages, bags_per_roll, units_per_box, price_pickup,
  price_delivery, featured, enabled, image_url, position
from public.catalog_items
on conflict(id) do nothing;

-- Comprobación: no debe modificar la cantidad de registros del Catálogo 1.
select
  (select count(*) from public.catalog_items) as catalogo_1_original,
  (select count(*) from public.catalog_full_items) as catalogo_2_independiente;
