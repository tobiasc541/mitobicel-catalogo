-- MITOBICEL: combo promotions and editable factory video.
create table if not exists public.combo_promotions(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 product_a_id text not null references public.catalog_items(id),
 product_b_id text not null references public.catalog_items(id),
 quantity_a integer not null check(quantity_a>=1),
 quantity_b integer not null check(quantity_b>=1),
 price_pickup numeric(14,2) check(price_pickup>=0),
 price_delivery numeric(14,2) check(price_delivery>=0),
 active boolean not null default true,
 sort_order integer not null default 1,
 check(product_a_id <> product_b_id)
);
alter table public.combo_promotions enable row level security;
grant select on public.combo_promotions to anon,authenticated;
grant insert,update,delete on public.combo_promotions to authenticated;
create policy "public visible combos" on public.combo_promotions for select to anon using(active);
create policy "admin view combos" on public.combo_promotions for select to authenticated using(active or exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin create combos" on public.combo_promotions for insert to authenticated with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin update combos" on public.combo_promotions for update to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid()))) with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin delete combos" on public.combo_promotions for delete to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create table if not exists public.site_settings(key text primary key,value text not null default '');
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon,authenticated;
grant insert,update,delete on public.site_settings to authenticated;
create policy "public read site settings" on public.site_settings for select to anon,authenticated using(true);
create policy "admin insert site settings" on public.site_settings for insert to authenticated with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin update site settings" on public.site_settings for update to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid()))) with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
insert into public.site_settings(key,value) values ('factory_video_url',''),('social_proof_text','') on conflict(key) do nothing;
