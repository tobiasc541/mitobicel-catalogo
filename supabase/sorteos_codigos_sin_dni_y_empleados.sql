-- MITOBICEL | Emisión de códigos de 4 dígitos sin DNI + personal con acceso restringido
-- Requiere las tablas de supabase/sorteos_mensuales.sql.
-- Ejecutar en SQL Editor del proyecto Supabase de MITOBICEL.
-- Es idempotente y preserva códigos e inscripciones anteriores.
begin;
create extension if not exists pgcrypto;

alter table public.raffle_codes add column if not exists buyer_dni text;
alter table public.raffle_codes add column if not exists issued_by uuid references auth.users(id) on delete set null;
alter table public.raffle_codes drop constraint if exists raffle_codes_code_check;
alter table public.raffle_codes add constraint raffle_codes_code_check
  check (code ~ '^([0-9]{4}|[A-Z0-9]{20,40})$');
alter table public.raffle_codes drop constraint if exists raffle_codes_code_key;
create unique index if not exists raffle_codes_campaign_buyer_code_unique
  on public.raffle_codes(campaign_id,buyer_dni,code);
create unique index if not exists raffle_codes_unassigned_short_unique
  on public.raffle_codes(campaign_id,code)
  where buyer_dni is null and code ~ '^[0-9]{4}$';
create index if not exists raffle_codes_redeem_lookup
  on public.raffle_codes(campaign_id,code,buyer_dni);
create index if not exists raffle_codes_issued_by_date
  on public.raffle_codes(issued_by,created_at desc);

create table if not exists public.raffle_failed_attempts(
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 dni text not null check(dni ~ '^[0-9]{7,9}$'),
 first_attempt timestamptz not null default now(),
 attempt_count integer not null default 0,
 primary key(campaign_id,dni)
);
alter table public.raffle_failed_attempts enable row level security;
revoke all on public.raffle_failed_attempts from public,anon,authenticated;

create table if not exists public.raffle_code_operators(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null
);
alter table public.raffle_code_operators enable row level security;
revoke all on public.raffle_code_operators from public,anon,authenticated;

-- Only the logged-in user learns whether they can operate the staff terminal.
create or replace function public.raffle_code_operator_authorized()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
   exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()))
   or exists(select 1 from public.raffle_code_operators o where o.user_id=(select auth.uid()))
 );
$$;
revoke all on function public.raffle_code_operator_authorized() from public,anon,authenticated;
grant execute on function public.raffle_code_operator_authorized() to authenticated;

-- Admin can grant/revoke ONLY the code generator permission, never full admin.
-- Employee first signs up or is invited in Supabase Auth with their own email/password.
create or replace function public.raffle_code_operator_manage(p_email text,p_enable boolean)
returns text language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_address text:=lower(btrim(coalesce(p_email,'')));
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.admin_users a where a.user_id=(select auth.uid())
 ) then raise exception 'Solo el administrador puede gestionar operadores.'; end if;
 if v_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 then raise exception 'Ingresá un correo válido.'; end if;
 select u.id into v_id from auth.users u
 where lower(u.email)=v_address and u.email_confirmed_at is not null limit 1;
 if v_id is null then
  raise exception 'El empleado debe crear y confirmar su cuenta desde /sorteos/personal antes de habilitarlo.';
 end if;
 if p_enable then
  insert into public.raffle_code_operators(user_id,created_by)
   values(v_id,(select auth.uid()))
   on conflict(user_id) do nothing;
  return 'Acceso de generador habilitado para '||v_address;
 else
  delete from public.raffle_code_operators where user_id=v_id;
  return 'Acceso de generador revocado para '||v_address;
 end if;
end;
$$;
revoke all on function public.raffle_code_operator_manage(text,boolean) from public,anon,authenticated;
grant execute on function public.raffle_code_operator_manage(text,boolean) to authenticated;

-- Only staff/admin; generated on the server, never client-side.
-- Limit emission to 30 codes/minute and 300/day per user; record issuer.
-- Four digits allow at most 10,000 distinct codes PER EDITION.
create or replace function public.raffle_issue_purchase_code(p_campaign_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=(select auth.uid());
 v_code text; v_id uuid; v_attempt integer;
begin
 if v_user is null or not (
  exists(select 1 from public.admin_users a where a.user_id=v_user)
  or exists(select 1 from public.raffle_code_operators o where o.user_id=v_user)
 ) then raise exception 'Acceso denegado para emitir códigos.'; end if;
 if not exists(
  select 1 from public.raffle_campaigns c
  where c.id=p_campaign_id and c.status='live' and now() between c.starts_at and c.ends_at
 ) then raise exception 'No hay una edición publicada con inscripciones abiertas.'; end if;
 -- Serialize the employee's issuance and all issue attempts for one edition.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mitobicel:codes:'||p_campaign_id::text));
 if (select count(*) from public.raffle_codes
   where issued_by=v_user and created_at>now()-interval '1 minute')>=30
 then raise exception 'Límite de 30 códigos por minuto. Intentá nuevamente en breve.'; end if;
 if (select count(*) from public.raffle_codes
   where issued_by=v_user and created_at>now()-interval '1 day')>=300
 then raise exception 'Alcanzaste el límite diario de 300 códigos para este empleado.'; end if;
 for v_attempt in 1..500 loop
  v_code:=pg_catalog.lpad(
   (pg_catalog.abs(pg_catalog.hashtext(pg_catalog.gen_random_uuid()::text)::bigint)%10000)::text,
   4,'0');
  -- Preserve legacy buyer-bound short codes and avoid ambiguity at redemption.
  if exists(select 1 from public.raffle_codes
   where campaign_id=p_campaign_id and code=v_code) then continue; end if;
  v_id:=null;
  insert into public.raffle_codes(campaign_id,code,store_name,buyer_dni,issued_by)
    values(p_campaign_id,v_code,'MITOBICEL 1',null,v_user)
    on conflict do nothing returning id into v_id;
  if v_id is not null then return v_code; end if;
 end loop;
 raise exception 'No se pudo asignar otro código de cuatro cifras. Contactá al administrador.';
end;
$$;
revoke all on function public.raffle_issue_purchase_code(uuid) from public,anon,authenticated;
grant execute on function public.raffle_issue_purchase_code(uuid) to authenticated;

-- Revoke access to old legacy DNI-required issuer, if installed.
do $do$ begin
 if to_regprocedure('public.raffle_issue_purchase_code(uuid,text)') is not null then
  revoke all on function public.raffle_issue_purchase_code(uuid,text) from public,anon,authenticated;
 end if;
end $do$;

-- Transactional one-time redemption. Supports new unassigned 4-digit codes,
-- older DNI-bound 4-digit codes, and legacy long tokens.
create or replace function public.raffle_register(
 p_campaign_id uuid,p_code text,p_first_name text,p_last_name text,
 p_dni text,p_phone text,p_free boolean,p_accept boolean
) returns text language plpgsql security definer set search_path='' as $$
declare
 c public.raffle_campaigns%rowtype;
 v_code public.raffle_codes%rowtype;
 v_entry uuid;
 v_dni text:=regexp_replace(coalesce(p_dni,''),'[^0-9]','','g');
 v_token text:=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
 v_fail public.raffle_failed_attempts%rowtype;
begin
 if not coalesce(p_accept,false) then return 'DENEGADO: Debés aceptar las bases y condiciones.'; end if;
 if length(btrim(coalesce(p_first_name,''))) not between 2 and 80
  or length(btrim(coalesce(p_last_name,''))) not between 2 and 80
 then return 'DENEGADO: Ingresá nombre y apellido completos.';end if;
 if v_dni !~ '^[0-9]{7,9}$' then return 'DENEGADO: Ingresá un DNI válido de 7 a 9 cifras.';end if;
 if length(btrim(coalesce(p_phone,''))) not between 8 and 30
 then return 'DENEGADO: Ingresá un teléfono válido.';end if;
 select * into c from public.raffle_campaigns
  where id=p_campaign_id and status='live' and now() between starts_at and ends_at;
 if not found then return 'DENEGADO: No hay inscripciones abiertas para esta edición.';end if;
 if length(btrim(c.terms))<80 or cardinality(c.prizes)=0
 then return 'DENEGADO: La edición necesita premios confirmados y bases publicadas.';end if;
 if coalesce(p_free,false) then
  -- Preserved for statutory free-entry requirements (see legal review).
  begin
   insert into public.raffle_entries(campaign_id,entry_type,first_name,last_name,dni,phone)
    values(c.id,'free',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone));
  exception when unique_violation then
   return 'DENEGADO: Ya utilizaste la participación gratuita de esta edición.';
  end;
 else
  if v_token !~ '^([0-9]{4}|[A-Z0-9]{20,40})$'
  then return 'DENEGADO: Ingresá los cuatro dígitos del código.';end if;
  select * into v_fail from public.raffle_failed_attempts
   where campaign_id=c.id and dni=v_dni for update;
  if found and v_fail.first_attempt>now()-interval '15 minutes'
    and v_fail.attempt_count>=5 then
   return 'DENEGADO: Demasiados intentos. Probá nuevamente después de 15 minutos.';
  end if;
  select * into v_code from public.raffle_codes
   where campaign_id=c.id and code=v_token
    and (buyer_dni is null or buyer_dni=v_dni)
    and used_at is null
   order by created_at desc limit 1 for update;
  if not found then
   insert into public.raffle_failed_attempts(campaign_id,dni,first_attempt,attempt_count)
    values(c.id,v_dni,now(),1)
   on conflict(campaign_id,dni) do update
    set attempt_count=case when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
     then 1 else public.raffle_failed_attempts.attempt_count+1 end,
     first_attempt=case when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
     then now() else public.raffle_failed_attempts.first_attempt end;
   return 'DENEGADO: Código inválido o utilizado. Revisalo e intentá nuevamente.';
  end if;
  insert into public.raffle_entries(campaign_id,code_id,entry_type,first_name,last_name,dni,phone)
    values(c.id,v_code.id,'purchase',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone))
    returning id into v_entry;
  update public.raffle_codes set used_at=now(),used_by=v_entry where id=v_code.id;
  delete from public.raffle_failed_attempts where campaign_id=c.id and dni=v_dni;
 end if;
 return 'Participación confirmada. ¡Muchos éxitos en el sorteo!';
end;
$$;
revoke all on function public.raffle_register(uuid,text,text,text,text,text,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.raffle_register(uuid,text,text,text,text,text,boolean,boolean)
 to anon,authenticated;
commit;
