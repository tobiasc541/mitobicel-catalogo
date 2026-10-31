-- MITOBICEL | Sorteos mensuales. Instalación independiente; NO toca los catálogos.
-- Ejecutar en el SQL Editor del proyecto MITOBICEL (una sola vez).
-- Nunca publicar un sorteo sin bases legales, premios confirmados y fechas.
create extension if not exists pgcrypto;

create table if not exists public.raffle_campaigns (
 id uuid primary key default gen_random_uuid(),
 period text not null unique check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 title text not null default 'Sorteo mensual MITOBICEL',
 subtitle text not null default 'Participá con tu código de un comercio autorizado',
 store_name text not null default 'Temper',
 prizes text[] not null default '{}'::text[],
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 draw_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','live','closed')),
 results_published boolean not null default false,
 terms text not null default '',
 video_url text not null default '',
 video_title text not null default 'Conocé las entregas de premios',
 free_instructions text not null default 'Participación gratuita desde el formulario, una vez por persona y mes.',
 created_at timestamptz not null default now(),
 constraint raffle_dates check (starts_at<ends_at and ends_at<=draw_at)
);
create table if not exists public.raffle_codes (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 code text not null unique check (code ~ '^[A-Z0-9]{20,40}$'),
 store_name text not null default 'Temper',
 created_at timestamptz not null default now(),
 used_at timestamptz,
 used_by uuid
);
create index if not exists raffle_codes_campaign_idx on public.raffle_codes(campaign_id);
create table if not exists public.raffle_entries (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 code_id uuid unique references public.raffle_codes(id) on delete set null,
 entry_type text not null check (entry_type in ('purchase','free')),
 first_name text not null,
 last_name text not null,
 dni text not null check (dni ~ '^[0-9]{7,9}$'),
 phone text not null,
 accepted_terms_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint raffle_entry_code check ((entry_type='free' and code_id is null) or (entry_type='purchase' and code_id is not null))
);
create unique index if not exists raffle_one_free_entry_per_dni on public.raffle_entries(campaign_id,dni) where entry_type='free';
create index if not exists raffle_entries_campaign_idx on public.raffle_entries(campaign_id);
alter table public.raffle_codes add constraint raffle_used_by_fk foreign key (used_by) references public.raffle_entries(id) on delete set null;
create table if not exists public.raffle_winners (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 entry_id uuid not null unique references public.raffle_entries(id),
 prize text not null,
 drawn_at timestamptz not null default now(),
 delivered_at timestamptz,
 delivery_video_url text not null default '',
 delivery_photo_url text not null default ''
);
create index if not exists raffle_winners_campaign_idx on public.raffle_winners(campaign_id);
alter table public.raffle_campaigns enable row level security;
alter table public.raffle_codes enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.raffle_winners enable row level security;
revoke all on public.raffle_campaigns,public.raffle_codes,public.raffle_entries,public.raffle_winners from anon,authenticated;
grant select on public.raffle_campaigns to anon,authenticated;
grant insert,update,delete on public.raffle_campaigns to authenticated;
grant select,insert,update,delete on public.raffle_codes,public.raffle_entries,public.raffle_winners to authenticated;

-- Admin role comes from existing authorized MITOBICEL admin_users table, not from editable user metadata.
create or replace function public.raffle_is_admin()
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()));
$$;
revoke all on function public.raffle_is_admin() from public,anon,authenticated;
grant execute on function public.raffle_is_admin() to authenticated;

create policy raffle_public_campaigns on public.raffle_campaigns
 for select to anon using (status in ('live','closed'));
create policy raffle_authenticated_campaigns on public.raffle_campaigns
 for select to authenticated using (status in ('live','closed') or (select public.raffle_is_admin()));
create policy raffle_admin_campaign_insert on public.raffle_campaigns
 for insert to authenticated with check ((select public.raffle_is_admin()));
create policy raffle_admin_campaign_update on public.raffle_campaigns
 for update to authenticated using ((select public.raffle_is_admin()))
 with check ((select public.raffle_is_admin()));
create policy raffle_admin_campaign_delete on public.raffle_campaigns
 for delete to authenticated using ((select public.raffle_is_admin()));

create policy raffle_admin_codes on public.raffle_codes for all to authenticated
 using ((select public.raffle_is_admin())) with check ((select public.raffle_is_admin()));
create policy raffle_admin_entries on public.raffle_entries for all to authenticated
 using ((select public.raffle_is_admin())) with check ((select public.raffle_is_admin()));
create policy raffle_admin_winners on public.raffle_winners for all to authenticated
 using ((select public.raffle_is_admin())) with check ((select public.raffle_is_admin()));

-- Atomic redemption. No direct anon access to codes or DNI data.
-- One coupon = exactly one entry. Free alternative = one entry per DNI and month.
create or replace function public.raffle_register(
 p_campaign_id uuid,p_code text,p_first_name text,p_last_name text,
 p_dni text,p_phone text,p_free boolean,p_accept boolean
) returns text language plpgsql security definer set search_path='' as $$
declare
 c public.raffle_campaigns%rowtype;
 v_code public.raffle_codes%rowtype;
 v_entry_id uuid;
 v_dni text:=regexp_replace(coalesce(p_dni,''),'[^0-9]','','g');
begin
 if not coalesce(p_accept,false) then raise exception 'Debés aceptar las bases y condiciones.';end if;
 if length(btrim(coalesce(p_first_name,''))) not between 2 and 80
  or length(btrim(coalesce(p_last_name,''))) not between 2 and 80
  or v_dni !~ '^[0-9]{7,9}$'
  or length(btrim(coalesce(p_phone,''))) not between 8 and 30 then
  raise exception 'Completá nombre, apellido, DNI y teléfono válidos.';
 end if;
 select * into c from public.raffle_campaigns
  where id=p_campaign_id and status='live' and now() between starts_at and ends_at;
 if not found then raise exception 'No hay una edición abierta para inscripciones.';end if;
 if length(btrim(c.terms))<80 or cardinality(c.prizes)=0 then
  raise exception 'La edición todavía no tiene bases y premios confirmados.';end if;
 if coalesce(p_free,false) then
  insert into public.raffle_entries(campaign_id,entry_type,first_name,last_name,dni,phone)
  values(c.id,'free',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone));
 else
  select * into v_code from public.raffle_codes
  where code=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'))
    and campaign_id=c.id for update;
  if not found then raise exception 'Código inválido para este sorteo.';end if;
  if v_code.used_at is not null then raise exception 'Este código ya fue utilizado.';end if;
  insert into public.raffle_entries(campaign_id,code_id,entry_type,first_name,last_name,dni,phone)
  values(c.id,v_code.id,'purchase',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone))
  returning id into v_entry_id;
  update public.raffle_codes set used_at=now(),used_by=v_entry_id where id=v_code.id;
 end if;
 return 'Participación registrada. Conservá tu comprobante o código para cualquier verificación.';
exception
 when unique_violation then
  raise exception 'Ya existe una participación para este código o para esta vía gratuita este mes.';
end;
$$;
revoke all on function public.raffle_register(uuid,text,text,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.raffle_register(uuid,text,text,text,text,text,boolean,boolean) to anon,authenticated;

-- The public response exposes no full names, full DNI, contact information, or coupon secrets.
create or replace function public.raffle_public_winners(p_campaign_id uuid)
returns table(prize text, winner_label text,dni_mask text,drawn_at timestamptz,delivered boolean,delivery_video_url text,delivery_photo_url text)
language sql stable security definer set search_path='' as $$
 select w.prize,
        e.first_name||' '||left(e.last_name,1)||'.',
        '***'||right(e.dni,3),
        w.drawn_at,w.delivered_at is not null,w.delivery_video_url,w.delivery_photo_url
 from public.raffle_winners w
 join public.raffle_entries e on e.id=w.entry_id
 join public.raffle_campaigns c on c.id=w.campaign_id
 where c.id=p_campaign_id and c.results_published=true and c.draw_at<=now()
   and now()<c.draw_at+interval '1 month'
 order by w.drawn_at;
$$;
revoke all on function public.raffle_public_winners(uuid) from public,anon,authenticated;
grant execute on function public.raffle_public_winners(uuid) to anon,authenticated;

-- Admin-only random selection, with an auditable winner record.
create or replace function public.raffle_draw(p_campaign_id uuid,p_prize text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry uuid;v_winner uuid;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then
  raise exception 'No autorizado.';end if;
 if length(btrim(coalesce(p_prize,'')))<2 then raise exception 'Elegí un premio válido.';end if;
 if not exists(select 1 from public.raffle_campaigns where id=p_campaign_id
  and draw_at<=now() and ends_at<=now() and status in ('live','closed')) then
  raise exception 'Todavía no llegó la fecha del sorteo o no está habilitado.';end if;
 -- Prevent concurrent draws in this campaign.
 perform pg_advisory_xact_lock(hashtext(p_campaign_id::text));
 select e.id into v_entry from public.raffle_entries e
 where e.campaign_id=p_campaign_id
  and not exists(select 1 from public.raffle_winners w where w.entry_id=e.id)
 order by gen_random_uuid() limit 1;
 if v_entry is null then raise exception 'No quedan participaciones elegibles.';end if;
 insert into public.raffle_winners(campaign_id,entry_id,prize)
 values(p_campaign_id,v_entry,btrim(p_prize)) returning id into v_winner;
 return v_winner;
end;
$$;
revoke all on function public.raffle_draw(uuid,text) from public,anon,authenticated;
grant execute on function public.raffle_draw(uuid,text) to authenticated;

-- For existing users, do not expose sensitive entries via realtime publications.
-- NOTE: ensure captcha / rate limits on public registration at the application edge before scale.

-- Galería pública de entregas: archivo histórico SIN DATOS PERSONALES.
create or replace function public.raffle_public_deliveries()
returns table(period text,prize text,delivered_at timestamptz,video_url text,photo_url text)
language sql stable security definer set search_path='' as $$
 select c.period,w.prize,w.delivered_at,w.delivery_video_url,w.delivery_photo_url
 from public.raffle_winners w join public.raffle_campaigns c on c.id=w.campaign_id
 where c.results_published=true and w.delivered_at is not null
   and (length(w.delivery_video_url)>0 or length(w.delivery_photo_url)>0)
 order by w.delivered_at desc limit 48;
$$;
revoke all on function public.raffle_public_deliveries() from public,anon,authenticated;
grant execute on function public.raffle_public_deliveries() to anon,authenticated;
