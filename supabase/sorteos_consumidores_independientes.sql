-- MITOBICEL | SORTEOS CONSUMIDOR FINAL
-- Instalacion separada de Sorteos Vendedores. No altera raffle_campaigns,
-- raffle_entries, raffle_codes, raffle_winners ni sus RPC existentes.
-- Ejecutar en el proyecto Supabase de MITOBICEL desde SQL Editor.
-- El QR impreso apunta a /sorteos/agradecimiento y no requiere codigo.
begin;

create table if not exists public.raffle_consumer_campaigns(
 id uuid primary key default gen_random_uuid(),
 period text not null unique check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 title text not null default 'Sorteo mensual para consumidores MITOBICEL',
 subtitle text not null default 'Gracias por elegir nuestros productos',
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 draw_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','live','closed')),
 prizes text[] not null default '{}'::text[],
 terms text not null default '',
 results_published boolean not null default false,
 prize_image_url text not null default '',
 hero_image_url text not null default '',
 video_url text not null default '',
 video_title text not null default 'Entregas de premios MITOBICEL',
 created_at timestamptz not null default now(),
 constraint raffle_consumer_dates check(starts_at<ends_at and ends_at<=draw_at)
);
create table if not exists public.raffle_consumer_entries(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.raffle_consumer_campaigns(id) on delete cascade,
 first_name text not null check(length(btrim(first_name)) between 2 and 80),
 last_name text not null check(length(btrim(last_name)) between 2 and 80),
 dni text not null check(dni ~ '^[0-9]{7,9}$'),
 phone text not null check(length(btrim(phone)) between 8 and 30),
 accepted_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(campaign_id,dni)
);
create index if not exists raffle_consumer_entries_campaign_idx on public.raffle_consumer_entries(campaign_id);
create table if not exists public.raffle_consumer_winners(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.raffle_consumer_campaigns(id) on delete cascade,
 entry_id uuid not null unique references public.raffle_consumer_entries(id) on delete restrict,
 prize text not null,
 drawn_at timestamptz not null default now(),
 delivered_at timestamptz,
 delivery_video_url text not null default '',
 delivery_photo_url text not null default ''
);
create index if not exists raffle_consumer_winners_campaign_idx on public.raffle_consumer_winners(campaign_id);

alter table public.raffle_consumer_campaigns enable row level security;
alter table public.raffle_consumer_entries enable row level security;
alter table public.raffle_consumer_winners enable row level security;
revoke all on public.raffle_consumer_campaigns,public.raffle_consumer_entries,public.raffle_consumer_winners from public,anon,authenticated;
grant select on public.raffle_consumer_campaigns to anon,authenticated;
grant insert,update,delete on public.raffle_consumer_campaigns to authenticated;
grant select,update on public.raffle_consumer_entries to authenticated;
grant select,insert,update,delete on public.raffle_consumer_winners to authenticated;

-- Authorization is based on existing MITOBICEL administrator IDs, not user metadata.
create or replace function public.raffle_consumer_is_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
  and exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()));
$$;
revoke all on function public.raffle_consumer_is_admin() from public,anon,authenticated;
grant execute on function public.raffle_consumer_is_admin() to authenticated;

drop policy if exists consumer_campaign_public on public.raffle_consumer_campaigns;
create policy consumer_campaign_public on public.raffle_consumer_campaigns
 for select to anon using(status in ('live','closed'));
drop policy if exists consumer_campaign_admin_select on public.raffle_consumer_campaigns;
create policy consumer_campaign_admin_select on public.raffle_consumer_campaigns
 for select to authenticated using(status in ('live','closed') or (select public.raffle_consumer_is_admin()));
drop policy if exists consumer_campaign_admin_insert on public.raffle_consumer_campaigns;
create policy consumer_campaign_admin_insert on public.raffle_consumer_campaigns
 for insert to authenticated with check((select public.raffle_consumer_is_admin()));
drop policy if exists consumer_campaign_admin_update on public.raffle_consumer_campaigns;
create policy consumer_campaign_admin_update on public.raffle_consumer_campaigns
 for update to authenticated using((select public.raffle_consumer_is_admin()))
 with check((select public.raffle_consumer_is_admin()));
drop policy if exists consumer_campaign_admin_delete on public.raffle_consumer_campaigns;
create policy consumer_campaign_admin_delete on public.raffle_consumer_campaigns
 for delete to authenticated using((select public.raffle_consumer_is_admin()));
drop policy if exists consumer_entries_admin_select on public.raffle_consumer_entries;
create policy consumer_entries_admin_select on public.raffle_consumer_entries
 for select to authenticated using((select public.raffle_consumer_is_admin()));
drop policy if exists consumer_winners_admin on public.raffle_consumer_winners;
create policy consumer_winners_admin on public.raffle_consumer_winners
 for all to authenticated using((select public.raffle_consumer_is_admin()))
 with check((select public.raffle_consumer_is_admin()));

-- Una inscripcion por DNI y por edicion. Sin codigo, DNI no verifica compra.
-- Limitacion: sin controles de captcha/IP en el borde, la API publica puede abusarse.
create or replace function public.raffle_consumer_register(
 p_campaign_id uuid,p_first_name text,p_last_name text,
 p_dni text,p_phone text,p_accept boolean
) returns text language plpgsql security definer set search_path='' as $$
declare
 c public.raffle_consumer_campaigns%rowtype;
 v_dni text:=regexp_replace(coalesce(p_dni,''),'[^0-9]','','g');
begin
 if not coalesce(p_accept,false) then return 'DENEGADO: Aceptá las bases y condiciones.';end if;
 if length(btrim(coalesce(p_first_name,''))) not between 2 and 80
  or length(btrim(coalesce(p_last_name,''))) not between 2 and 80
 then return 'DENEGADO: Completá nombre y apellido.';end if;
 if v_dni !~ '^[0-9]{7,9}$' then return 'DENEGADO: Ingresá un DNI válido.';end if;
 if length(btrim(coalesce(p_phone,''))) not between 8 and 30
 then return 'DENEGADO: Ingresá tu teléfono con código de área.';end if;
 select * into c from public.raffle_consumer_campaigns
 where id=p_campaign_id and status='live' and now() between starts_at and ends_at;
 if not found then return 'DENEGADO: No hay inscripciones abiertas para compradores.';end if;
 if length(btrim(c.terms))<80 or cardinality(c.prizes)=0
 then return 'DENEGADO: La edición aún no tiene premios y bases confirmados.';end if;
 begin
  insert into public.raffle_consumer_entries(campaign_id,first_name,last_name,dni,phone)
  values(c.id,btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone));
 exception when unique_violation then
  return 'DENEGADO: Este DNI ya figura inscripto en la edición de compradores.';
 end;
 return '¡Inscripción confirmada! Gracias por elegir MITOBICEL. Que Dios te bendiga.';
end;
$$;
revoke all on function public.raffle_consumer_register(uuid,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.raffle_consumer_register(uuid,text,text,text,text,boolean) to anon,authenticated;

-- El administrador realiza el sorteo solo despues del cierre; cada DNI gana como maximo una vez.
create or replace function public.raffle_consumer_draw(p_campaign_id uuid,p_prize text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry uuid;v_winner uuid;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid())
 ) then raise exception 'Solo superadministradores pueden sortear.';end if;
 if length(btrim(coalesce(p_prize,'')))<2 then raise exception 'Elegí un premio.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('consumer:'||p_campaign_id::text));
 if not exists(select 1 from public.raffle_consumer_campaigns
    where id=p_campaign_id and status in ('live','closed')
     and now()>=draw_at and now()>=ends_at and p_prize=any(prizes)
 ) then raise exception 'La fecha del sorteo no llegó o el premio no está confirmado.';end if;
 if exists(select 1 from public.raffle_consumer_winners
   where campaign_id=p_campaign_id and prize=btrim(p_prize))
 then raise exception 'Ya sorteaste un ganador para ese premio.';end if;
 select e.id into v_entry from public.raffle_consumer_entries e
 where e.campaign_id=p_campaign_id
  and not exists(select 1 from public.raffle_consumer_winners w where w.entry_id=e.id)
 order by gen_random_uuid() limit 1;
 if v_entry is null then raise exception 'No hay participantes elegibles.';end if;
 insert into public.raffle_consumer_winners(campaign_id,entry_id,prize)
 values(p_campaign_id,v_entry,btrim(p_prize)) returning id into v_winner;
 return v_winner;
end;
$$;
revoke all on function public.raffle_consumer_draw(uuid,text) from public,anon,authenticated;
grant execute on function public.raffle_consumer_draw(uuid,text) to authenticated;

-- Datos anonimos: no enviar telefono ni DNI completo.
create or replace function public.raffle_consumer_public_winners(p_campaign_id uuid)
returns table(prize text,winner_label text,dni_mask text,drawn_at timestamptz,
 delivered boolean,delivery_video_url text,delivery_photo_url text)
language sql stable security definer set search_path='' as $$
 select w.prize,e.first_name||' '||left(e.last_name,1)||'.',
 '***'||right(e.dni,3),w.drawn_at,w.delivered_at is not null,
 w.delivery_video_url,w.delivery_photo_url
 from public.raffle_consumer_winners w
 join public.raffle_consumer_entries e on e.id=w.entry_id
 join public.raffle_consumer_campaigns c on c.id=w.campaign_id
 where w.campaign_id=p_campaign_id
  and c.results_published=true and c.draw_at<=now()
  and now()<c.draw_at+interval '1 month'
 order by w.drawn_at;
$$;
revoke all on function public.raffle_consumer_public_winners(uuid) from public,anon,authenticated;
grant execute on function public.raffle_consumer_public_winners(uuid) to anon,authenticated;

create or replace function public.raffle_consumer_public_deliveries()
returns table(period text,prize text,delivered_at timestamptz,video_url text,photo_url text)
language sql stable security definer set search_path='' as $$
 select c.period,w.prize,w.delivered_at,w.delivery_video_url,w.delivery_photo_url
 from public.raffle_consumer_winners w
 join public.raffle_consumer_campaigns c on c.id=w.campaign_id
 where c.results_published=true and w.delivered_at is not null
  and (length(w.delivery_video_url)>0 or length(w.delivery_photo_url)>0)
 order by w.delivered_at desc limit 50;
$$;
revoke all on function public.raffle_consumer_public_deliveries() from public,anon,authenticated;
grant execute on function public.raffle_consumer_public_deliveries() to anon,authenticated;

commit;
