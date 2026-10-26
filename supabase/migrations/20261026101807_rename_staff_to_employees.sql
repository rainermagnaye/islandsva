-- Renames "staff" to "employees": the table, its enums, constraints, indexes, triggers and policies.
-- A rename keeps the rows, grants (column grants too), RLS and foreign keys; policies and triggers on other
-- tables point at the table, not its name. Function bodies are text, so the four that query the table by
-- name are redefined below — unchanged except for the new name.
--
-- Apply together with the app release that uses `employee_profiles`: the old app breaks once this runs.

alter table public.staff_profiles rename to employee_profiles;

alter type public.staff_gender rename to employee_gender;
alter type public.staff_marital_status rename to employee_marital_status;
alter type public.staff_registration_status rename to employee_registration_status;
alter type public.staff_review_status rename to employee_review_status;

-- Constraint names differ by Postgres version (newer ones name NOT NULLs too), so rename whatever exists.
-- Renaming the primary key constraint renames its index as well.
do $$
declare
  r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.employee_profiles'::regclass and c.conname like 'staff\_profiles\_%'
  loop
    execute format('alter table public.employee_profiles rename constraint %I to %I',
      r.conname, 'employee_profiles_' || substr(r.conname, length('staff_profiles_') + 1));
  end loop;
  for r in
    select i.relname from pg_index x join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.employee_profiles'::regclass and i.relname like 'staff\_profiles\_%'
  loop
    execute format('alter index public.%I rename to %I',
      r.relname, 'employee_profiles_' || substr(r.relname, length('staff_profiles_') + 1));
  end loop;
end;
$$;

alter trigger staff_profiles_set_updated_at on public.employee_profiles rename to employee_profiles_set_updated_at;
alter trigger staff_profiles_assign_tenant on public.employee_profiles rename to employee_profiles_assign_tenant;

alter policy "Read own staff profile; admins read all" on public.employee_profiles
  rename to "Read own employee profile; admins read all";
alter policy "Staff insert own staff profile; admins insert any" on public.employee_profiles
  rename to "Employees insert own employee profile; admins insert any";
alter policy "Staff update own staff profile; admins update any" on public.employee_profiles
  rename to "Employees update own employee profile; admins update any";

-- Every existing case, with staff_profiles now employee_profiles.
create or replace function private.assign_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := case tg_table_name
      when 'roles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'employee_profiles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'clients' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      when 'client_va_assignments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'lead_events' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'client_notes' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_onboarding_links' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'payments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_packets' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'demo_slots' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      when 'demo_bookings' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create or replace function private.va_is_open(va uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    left join public.employee_profiles ep on ep.user_id = p.id
    where r.user_id = va and r.role = 'va' and p.status <> 'inactive'
      and (ep.review_status = 'approved' or (ep.user_id is null and p.status = 'active'))
  );
$$;

create or replace function public.book_demo(client_id uuid, slot_id uuid, actor uuid, note text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  client public.clients%rowtype;
  slot public.demo_slots%rowtype;
  va public.profiles%rowtype;
  clean_note text := nullif(btrim(note), '');
  new_id uuid;
begin
  select * into client from public.clients c where c.id = book_demo.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;
  -- The client's own login, still active (a deactivated login's token keeps its role for up to an hour).
  if client.user_id is null or client.user_id is distinct from actor
    or not exists (select 1 from public.profiles p where p.id = actor and p.status <> 'inactive') then
    raise exception 'only the client can book their demo' using errcode = 'IVA14';
  end if;
  if client.status <> 'active' then
    raise exception 'the client is %', client.status using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'the client is disabled' using errcode = 'IVA07';
  end if;
  if exists (select 1 from public.client_va_assignments a where a.client_id = client.id and a.status = 'active') then
    raise exception 'the client already has a VA' using errcode = 'IVA16';
  end if;

  -- Settle stale bookings (no cron): a request nobody answered before it started has expired; a confirmed demo
  -- that has ended is done.
  update public.demo_bookings b set status = 'expired'
  where b.client_id = client.id and b.status = 'pending' and b.starts_at <= now();
  update public.demo_bookings b set status = 'completed'
  where b.client_id = client.id and b.status = 'confirmed' and b.ends_at <= now();
  if exists (select 1 from public.demo_bookings b where b.client_id = client.id and b.status in ('pending', 'confirmed')) then
    raise exception 'the client already has an open demo' using errcode = 'IVA17';
  end if;

  select * into slot from public.demo_slots s where s.id = book_demo.slot_id and s.tenant_id = client.tenant_id for update;
  if not found then
    raise exception 'slot not found' using errcode = 'IVA18';
  end if;
  -- The slot's VA must still be open (the same rule as private.va_is_open) and the slot unused.
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    left join public.employee_profiles ep on ep.user_id = p.id
    where r.user_id = slot.va_id and r.role = 'va' and p.status <> 'inactive'
      and (ep.review_status = 'approved' or (ep.user_id is null and p.status = 'active'))
  ) or exists (select 1 from public.demo_bookings b where b.slot_id = slot.id and b.status <> 'cancelled') then
    raise exception 'this time is no longer available' using errcode = 'IVA18';
  end if;
  if slot.starts_at < now() + interval '4 hours' or slot.starts_at > now() + interval '14 days' then
    raise exception 'demos are booked 4 hours to 14 days ahead' using errcode = 'IVA19';
  end if;

  select * into va from public.profiles p where p.id = slot.va_id;
  insert into public.demo_bookings as b (client_id, va_id, slot_id, starts_at, ends_at, client_note, booked_by, company_name, client_timezone, va_name)
  values (client.id, slot.va_id, slot.id, slot.starts_at, slot.ends_at, clean_note, actor, client.company_name, client.timezone,
    coalesce(nullif(split_part(btrim(va.full_name), ' ', 1), ''), 'Your VA'))
  returning b.id into new_id;

  return jsonb_build_object('id', new_id, 'va_email', va.email, 'va_name', va.full_name, 'company_name', client.company_name,
    'client_timezone', client.timezone, 'starts_at', slot.starts_at, 'client_note', clean_note);
end;
$$;

create or replace function public.decide_demo(booking_id uuid, actor uuid, decision text, reason text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  booking public.demo_bookings%rowtype;
  clean_reason text := case when decision = 'rejected' then nullif(btrim(reason), '') end;
  login_email text;
  contact text;
begin
  select * into booking from public.demo_bookings b where b.id = decide_demo.booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  -- The booking's VA, still a VA and open (the same rule as private.va_is_open).
  if booking.va_id is distinct from actor or not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    left join public.employee_profiles ep on ep.user_id = p.id
    where r.user_id = actor and r.role = 'va' and p.status <> 'inactive'
      and (ep.review_status = 'approved' or (ep.user_id is null and p.status = 'active'))
  ) then
    raise exception 'only the booking''s VA can decide it' using errcode = 'IVA14';
  end if;
  if decision is null or decision not in ('confirmed', 'rejected') then
    raise exception 'decision must be confirmed or rejected' using errcode = 'check_violation';
  end if;
  if booking.status <> 'pending' or booking.starts_at <= now() then
    raise exception 'this demo is % and can''t be decided', booking.status using errcode = 'IVA20';
  end if;

  update public.demo_bookings b set status = decision::public.demo_status, decided_at = now(), reject_reason = clean_reason
  where b.id = booking.id;

  -- The client's own login email (as for the account email), not the contact email on the record.
  select p.email, c.contact_name into login_email, contact
  from public.clients c left join public.profiles p on p.id = c.user_id where c.id = booking.client_id;
  return jsonb_build_object('status', decision, 'client_email', login_email, 'contact_name', contact, 'company_name', booking.company_name,
    'client_timezone', booking.client_timezone, 'starts_at', booking.starts_at, 'va_name', booking.va_name, 'reject_reason', clean_reason);
end;
$$;
