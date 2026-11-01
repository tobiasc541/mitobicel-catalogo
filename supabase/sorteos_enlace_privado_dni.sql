-- MITOBICEL | Acceso por enlace privado + DNI declarativo, sin cuentas de empleado
-- Ejecutar en SQL Editor del proyecto MITOBICEL luego de sorteos_mensuales.sql.
-- Esta instalación incluye soporte de códigos cortos y registro sin DNI previo.
-- No ejecuta cambios sobre los catálogos ni elimina inscripciones anteriores.
begin;

-- Habilitar códigos de 4 números sin DNI asignado.
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

create table if not exists public.raffle_failed_attempts(
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 dni text not null check(dni ~ '^[0-9]{7,9}$'),
 first_attempt timestamptz not null default now(),
 attempt_count integer not null default 0,
 primary key(campaign_id,dni)
);
alter table public.raffle_failed_attempts enable row level security;
revoke all on public.raffle_failed_attempts from public,anon,authenticated;

-- The random bearer token is NEVER stored: only a SHA-256 fingerprint.
create table if not exists public.raffle_staff_links(
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_by uuid references auth.users(id) on delete set null
);
alter table public.raffle_staff_links enable row level security;
revoke all on public.raffle_staff_links from public,anon,authenticated;

-- Audit only a pseudonym of the declared DNI, never its plaintext.
create table if not exists public.raffle_staff_issuances(
 id uuid primary key default gen_random_uuid(),
 staff_link_id uuid not null references public.raffle_staff_links(id),
 code_id uuid not null unique references public.raffle_codes(id),
 campaign_id uuid not null references public.raffle_campaigns(id),
 employee_dni_hash text not null check (employee_dni_hash ~ '^[0-9a-f]{64}$'),
 issued_at timestamptz not null default now()
);
alter table public.raffle_staff_issuances enable row level security;
revoke all on public.raffle_staff_issuances from public,anon,authenticated;
create index if not exists raffle_staff_issuances_link_at on public.raffle_staff_issuances(staff_link_id,issued_at desc);
create index if not exists raffle_staff_issuances_dni_at on public.raffle_staff_issuances(employee_dni_hash,issued_at desc);

-- Admin creates ONE private staff link; this also revokes any previous active link.
-- It isn't an approval step per employee. Return token once, never persist raw token.
create or replace function public.raffle_staff_link_create()
returns text language plpgsql security definer set search_path='' as $$
declare v_token text;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.admin_users where user_id=(select auth.uid())
 ) then raise exception 'Solo el superadministrador puede crear el enlace privado.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mitobicel-staff-link'));
 update public.raffle_staff_links set revoked_at=now() where revoked_at is null;
 v_token:=pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','')||
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','');
 insert into public.raffle_staff_links(token_hash,expires_at,created_by)
 values(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_token,'UTF8')),'hex'),
        now()+interval '90 days',(select auth.uid()));
 return v_token;
end;
$$;
revoke all on function public.raffle_staff_link_create() from public,anon,authenticated;
grant execute on function public.raffle_staff_link_create() to authenticated;

create or replace function public.raffle_staff_link_revoke()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.admin_users where user_id=(select auth.uid())
 ) then raise exception 'Solo el superadministrador puede revocar el enlace.'; end if;
 update public.raffle_staff_links set revoked_at=now() where revoked_at is null;
 get diagnostics v_count=row_count;
 return v_count;
end;
$$;
revoke all on function public.raffle_staff_link_revoke() from public,anon,authenticated;
grant execute on function public.raffle_staff_link_revoke() to authenticated;

-- Can be called anonymously ONLY with the private random token.
-- DNI is a declared employee identifier, NOT a password or identity verification.
-- Serializes issuance per link and campaign; limits both link and declared DNI usage.
create or replace function public.raffle_staff_issue_code(p_token text,p_employee_dni text)
returns text language plpgsql security definer set search_path='' as $$
declare
 v_link public.raffle_staff_links%rowtype;
 v_campaign uuid;
 v_doc text:=regexp_replace(coalesce(p_employee_dni,''),'[^0-9]','','g');
 v_doc_hash text;
 v_code text;
 v_code_id uuid;
 v_attempt integer;
begin
 if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' or length(coalesce(p_token,''))<>64 then
  raise exception 'Enlace privado inválido. Solicitá otro al administrador.';
 end if;
 if v_doc !~ '^[0-9]{7,9}$' then
  raise exception 'Ingresá un DNI válido de 7 a 9 números.';
 end if;
 select * into v_link from public.raffle_staff_links
 where token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
   and revoked_at is null and expires_at>now()
 for update;
 if not found then raise exception 'Enlace caducado o revocado. Solicitá uno nuevo.';end if;

 select c.id into v_campaign from public.raffle_campaigns c
 where c.status='live' and now() between c.starts_at and c.ends_at
   and cardinality(c.prizes)>0 and length(btrim(c.terms))>=80
 order by c.period desc limit 1;
 if v_campaign is null then
  raise exception 'Todavía no hay un sorteo publicado con inscripciones abiertas.';
 end if;

 v_doc_hash:=pg_catalog.encode(pg_catalog.sha256(
   pg_catalog.convert_to(p_token||':'||v_doc,'UTF8')),'hex');

 if (select count(*) from public.raffle_staff_issuances
     where staff_link_id=v_link.id and issued_at>now()-interval '1 minute') >=20 then
   raise exception 'Demasiados códigos en un minuto. Probá nuevamente en breve.';
 end if;
 if (select count(*) from public.raffle_staff_issuances
     where staff_link_id=v_link.id and issued_at>now()-interval '1 day') >=300 then
   raise exception 'Se alcanzó el límite de 300 códigos diarios para este enlace.';
 end if;
 if (select count(*) from public.raffle_staff_issuances
     where staff_link_id=v_link.id and employee_dni_hash=v_doc_hash
       and issued_at>now()-interval '1 minute') >=12 then
   raise exception 'Alcanzaste el límite por empleado. Probá más tarde.';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mitobicel:codes:'||v_campaign::text));
 for v_attempt in 1..500 loop
  v_code:=pg_catalog.lpad((
    pg_catalog.abs(pg_catalog.hashtext(pg_catalog.gen_random_uuid()::text)::bigint)%10000
  )::text,4,'0');
  if exists(select 1 from public.raffle_codes where campaign_id=v_campaign and code=v_code)
    then continue; end if;
  v_code_id:=null;
  insert into public.raffle_codes(campaign_id,code,store_name,buyer_dni)
  values(v_campaign,v_code,'MITOBICEL 1',null)
  on conflict do nothing returning id into v_code_id;
  if v_code_id is not null then
    insert into public.raffle_staff_issuances(staff_link_id,code_id,campaign_id,employee_dni_hash)
    values(v_link.id,v_code_id,v_campaign,v_doc_hash);
    return v_code;
  end if;
 end loop;
 raise exception 'No quedan códigos disponibles en esta edición.';
end;
$$;
revoke all on function public.raffle_staff_issue_code(text,text) from public,anon,authenticated;
grant execute on function public.raffle_staff_issue_code(text,text) to anon,authenticated;


-- Admin retains one-click issuance from the superadministrator (no employee DNI).
create or replace function public.raffle_issue_purchase_code(p_campaign_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_code text;v_id uuid;v_attempt integer;
begin
 if v_user is null or not exists(
  select 1 from public.admin_users where user_id=v_user
 ) then raise exception 'Solo el administrador puede generar desde este panel.';end if;
 if not exists(select 1 from public.raffle_campaigns
    where id=p_campaign_id and status='live' and now() between starts_at and ends_at
 ) then raise exception 'La edición debe estar publicada y abierta.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mitobicel:codes:'||p_campaign_id::text));
 for v_attempt in 1..500 loop
  v_code:=pg_catalog.lpad((
   pg_catalog.abs(pg_catalog.hashtext(pg_catalog.gen_random_uuid()::text)::bigint)%10000
  )::text,4,'0');
  if exists(select 1 from public.raffle_codes
    where campaign_id=p_campaign_id and code=v_code) then continue;end if;
  v_id:=null;
  insert into public.raffle_codes(campaign_id,code,store_name,buyer_dni,issued_by)
   values(p_campaign_id,v_code,'MITOBICEL 1',null,v_user)
   on conflict do nothing returning id into v_id;
  if v_id is not null then return v_code;end if;
 end loop;
 raise exception 'No quedan códigos disponibles.';
end;
$$;
revoke all on function public.raffle_issue_purchase_code(uuid) from public,anon,authenticated;
grant execute on function public.raffle_issue_purchase_code(uuid) to authenticated;

-- Required to redeem the new 4-digit codes that are not bound to a buyer DNI.
-- Uses the previous 8-parameter public API signature.
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
 if not coalesce(p_accept,false) then return 'DENEGADO: Debés aceptar las bases y condiciones.';end if;
 if length(btrim(coalesce(p_first_name,''))) not between 2 and 80
  or length(btrim(coalesce(p_last_name,''))) not between 2 and 80
 then return 'DENEGADO: Escribí nombre y apellido completos.';end if;
 if v_dni !~ '^[0-9]{7,9}$' then return 'DENEGADO: Ingresá un DNI válido.';end if;
 if length(btrim(coalesce(p_phone,''))) not between 8 and 30
 then return 'DENEGADO: Ingresá un teléfono válido.';end if;
 select * into c from public.raffle_campaigns
 where id=p_campaign_id and status='live' and now() between starts_at and ends_at;
 if not found then return 'DENEGADO: No hay inscripciones abiertas.';end if;
 if length(btrim(c.terms))<80 or cardinality(c.prizes)=0
 then return 'DENEGADO: La edición requiere bases y premios publicados.';end if;
 if coalesce(p_free,false) then
  -- Legal route retained in the database; confirm regulatory requirements before launch.
  begin
   insert into public.raffle_entries(campaign_id,entry_type,first_name,last_name,dni,phone)
    values(c.id,'free',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone));
  exception when unique_violation then
   return 'DENEGADO: Ya utilizaste esta participación de la edición.';
  end;
 else
  if v_token !~ '^([0-9]{4}|[A-Z0-9]{20,40})$'
  then return 'DENEGADO: El código tiene que tener cuatro números.';end if;
  select * into v_fail from public.raffle_failed_attempts
   where campaign_id=c.id and dni=v_dni for update;
  if found and v_fail.first_attempt>now()-interval '15 minutes'
    and v_fail.attempt_count>=5 then
   return 'DENEGADO: Demasiados intentos. Probá nuevamente en 15 minutos.';
  end if;
  select * into v_code from public.raffle_codes
    where campaign_id=c.id and code=v_token and used_at is null
      and (buyer_dni is null or buyer_dni=v_dni)
    order by created_at desc limit 1 for update;
  if not found then
   insert into public.raffle_failed_attempts(campaign_id,dni,first_attempt,attempt_count)
    values(c.id,v_dni,now(),1)
   on conflict(campaign_id,dni) do update
    set attempt_count=case
     when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
     then 1 else public.raffle_failed_attempts.attempt_count+1 end,
     first_attempt=case
     when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
     then now() else public.raffle_failed_attempts.first_attempt end;
   return 'DENEGADO: Código inválido o utilizado.';
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
