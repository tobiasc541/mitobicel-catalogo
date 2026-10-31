-- MITOBICEL: códigos cortos de cuatro cifras vinculados al DNI de cada comprador.
-- Aplicar después de sorteos_mensuales.sql y sorteos_qr_unico_imagen_premio_bases.sql.
-- Mantiene códigos largos e inscripciones ya existentes. No modifica catálogos ni QR general.
begin;

alter table public.raffle_codes add column if not exists buyer_dni text;
alter table public.raffle_codes drop constraint if exists raffle_codes_code_check;
alter table public.raffle_codes
 add constraint raffle_codes_code_check check (code ~ '^([0-9]{4}|[A-Z0-9]{20,40})$');
alter table public.raffle_codes drop constraint if exists raffle_codes_buyer_dni_check;
alter table public.raffle_codes
 add constraint raffle_codes_buyer_dni_check check (buyer_dni is null or buyer_dni ~ '^[0-9]{7,9}$');
-- Legacy coupon codes were globally unique. Four digits can be reused only for DIFFERENT
-- validated buyers, or in distinct editions, never twice for the same buyer in an edition.
alter table public.raffle_codes drop constraint if exists raffle_codes_code_key;
create unique index if not exists raffle_codes_campaign_buyer_code_unique
 on public.raffle_codes(campaign_id, buyer_dni, code);
create index if not exists raffle_codes_redeem_lookup
 on public.raffle_codes(campaign_id, code, buyer_dni);

create table if not exists public.raffle_failed_attempts(
 campaign_id uuid not null references public.raffle_campaigns(id) on delete cascade,
 dni text not null check(dni ~ '^[0-9]{7,9}$'),
 first_attempt timestamptz not null default now(),
 attempt_count integer not null default 0,
 primary key(campaign_id,dni)
);
alter table public.raffle_failed_attempts enable row level security;
revoke all on public.raffle_failed_attempts from anon,authenticated;

-- Only a logged-in MITOBICEL administrator may issue a short code, and only
-- after checking the sale and asking the buyer for their DNI.
create or replace function public.raffle_issue_purchase_code(p_campaign_id uuid,p_buyer_dni text)
returns text
language plpgsql security definer set search_path='' as $$
declare
 v_dni text:=regexp_replace(coalesce(p_buyer_dni,''),'[^0-9]','','g');
 v_bytes bytea;
 v_code text;
 v_attempt integer;
begin
 if not exists(select 1 from public.admin_users where user_id=(select auth.uid())) then
  raise exception 'No tenés permisos para emitir códigos.';
 end if;
 if v_dni !~ '^[0-9]{7,9}$' then raise exception 'Ingresá el DNI completo del comprador (7 a 9 números).';end if;
 if not exists(select 1 from public.raffle_campaigns
  where id=p_campaign_id and status='live' and now() between starts_at and ends_at) then
  raise exception 'La edición debe estar publicada y dentro de su período de inscripción.';
 end if;
 perform pg_advisory_xact_lock(hashtext(p_campaign_id::text||':'||v_dni));
 for v_attempt in 1..150 loop
  v_bytes:=gen_random_bytes(2);
  v_code:=lpad((((get_byte(v_bytes,0)*256+get_byte(v_bytes,1)) % 10000))::text,4,'0');
  insert into public.raffle_codes(campaign_id,store_name,code,buyer_dni)
  values(p_campaign_id,'MITOBICEL 1',v_code,v_dni)
  on conflict do nothing;
  if found then return v_code; end if;
 end loop;
 raise exception 'No quedan combinaciones disponibles para este DNI. Contactá soporte.';
end;
$$;
revoke all on function public.raffle_issue_purchase_code(uuid,text) from public,anon,authenticated;
grant execute on function public.raffle_issue_purchase_code(uuid,text) to authenticated;

-- Existing RPC signature and old 24-character tokens retained for compatibility.
-- Failed short-code attempts are counted without throwing an exception, so they
-- cannot be rolled back. Five failures trigger a 15-minute per-DNI cooldown.
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
 if length(btrim(coalesce(p_first_name,''))) not between 2 and 80 then
  return 'DENEGADO: El nombre debe tener al menos dos letras.';
 end if;
 if length(btrim(coalesce(p_last_name,''))) not between 2 and 80 then
  return 'DENEGADO: El apellido debe tener al menos dos letras.';
 end if;
 if v_dni !~ '^[0-9]{7,9}$' then return 'DENEGADO: Ingresá un DNI válido de 7 a 9 cifras.';end if;
 if length(btrim(coalesce(p_phone,''))) not between 8 and 30 then
  return 'DENEGADO: Ingresá un teléfono válido, con código de área.';
 end if;
 select * into c from public.raffle_campaigns
  where id=p_campaign_id and status='live' and now() between starts_at and ends_at;
 if not found then return 'DENEGADO: No hay inscripciones abiertas para esta edición.';end if;
 if length(btrim(c.terms))<80 or cardinality(c.prizes)=0 then
  return 'DENEGADO: La edición necesita premios confirmados y bases publicadas.';
 end if;
 if coalesce(p_free,false) then
  begin
   insert into public.raffle_entries(campaign_id,entry_type,first_name,last_name,dni,phone)
   values(c.id,'free',btrim(p_first_name),btrim(p_last_name),v_dni,btrim(p_phone));
  exception when unique_violation then
   return 'DENEGADO: Ya utilizaste la participación gratuita de esta edición.';
  end;
 else
  if v_token !~ '^([0-9]{4}|[A-Z0-9]{20,40})$' then
   return 'DENEGADO: Escribí los cuatro números del código de compra.';
  end if;
  select * into v_fail from public.raffle_failed_attempts
   where campaign_id=c.id and dni=v_dni for update;
  if found and v_fail.first_attempt > now()-interval '15 minutes'
   and v_fail.attempt_count>=5 then
   return 'DENEGADO: Demasiados intentos. Probá nuevamente dentro de 15 minutos o consultá al comercio.';
  end if;
  select * into v_code
   from public.raffle_codes
   where campaign_id=c.id
     and code=v_token
     and (buyer_dni=v_dni or (buyer_dni is null and length(code)>=20))
     and used_at is null
   order by created_at desc limit 1 for update;
  if not found then
   insert into public.raffle_failed_attempts(campaign_id,dni,first_attempt,attempt_count)
   values(c.id,v_dni,now(),1)
   on conflict (campaign_id,dni) do update
   set attempt_count=case
      when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
       then 1 else public.raffle_failed_attempts.attempt_count+1 end,
       first_attempt=case
      when public.raffle_failed_attempts.first_attempt<=now()-interval '15 minutes'
       then now() else public.raffle_failed_attempts.first_attempt end;
   return 'DENEGADO: Código inválido, ya utilizado o asociado a otro DNI. Consultá al comercio por un código vigente.';
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
