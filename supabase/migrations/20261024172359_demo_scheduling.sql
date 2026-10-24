-- Demo scheduling (M5/M6): VAs publish 30-minute slots; a client without a VA books one demo call on a slot of
-- any approved VA in their tenant; that VA confirms or rejects it; the client may cancel before it starts.
-- The 1-call rule: one open (pending or confirmed) demo per client, enforced by a partial unique index. No cron:
-- book_demo settles the client's stale bookings first, and the app shows the same through demoState().

create type public.demo_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'expired');

-- Slots ------------------------------------------------------------------------------------------------------

create table public.demo_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  va_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Fixed 30-minute slots on :00 or :30 (UTC and Manila, +08:00, share those boundaries).
  constraint demo_slots_length check (ends_at = starts_at + interval '30 minutes'),
  constraint demo_slots_aligned check (extract(epoch from starts_at)::bigint % 1800 = 0),
  constraint demo_slots_va_starts_at_key unique (va_id, starts_at),
  constraint demo_slots_id_tenant_key unique (id, tenant_id)
);

-- Bookings ---------------------------------------------------------------------------------------------------

create table public.demo_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  client_id uuid not null,
  va_id uuid not null,
  -- Kept while the slot exists; the time is copied, so the booking survives the slot's deletion.
  slot_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.demo_status not null default 'pending',
  client_note text check (client_note is null or char_length(client_note) between 1 and 500),
  reject_reason text check (reject_reason is null or char_length(reject_reason) between 1 and 300),
  decided_at timestamptz,
  cancelled_at timestamptz,
  booked_by uuid not null,
  -- Snapshots: the VA sees what was booked without reading the client's record (which holds billing), and the
  -- client sees the VA's first name without reading profiles.
  company_name text not null,
  client_timezone text,
  va_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_bookings_length check (ends_at = starts_at + interval '30 minutes'),
  constraint demo_bookings_pending_undecided check (status <> 'pending' or (decided_at is null and cancelled_at is null)),
  constraint demo_bookings_decided check (status not in ('confirmed', 'rejected', 'completed') or decided_at is not null),
  constraint demo_bookings_cancelled check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint demo_bookings_reason check (reject_reason is null or status = 'rejected')
);

-- One open demo per client (the 1-call rule), and each slot used once: a rejected slot stays used, a cancelled
-- one frees up.
create unique index demo_bookings_one_open_per_client on public.demo_bookings (client_id) where status in ('pending', 'confirmed');
create unique index demo_bookings_slot_once on public.demo_bookings (slot_id) where status <> 'cancelled';

-- Tenants ----------------------------------------------------------------------------------------------------

-- Slots inherit their VA's tenant, bookings their client's. The previous cases stay as they are.
create or replace function private.assign_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := case tg_table_name
      when 'roles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'staff_profiles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'clients' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      when 'client_va_assignments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'lead_events' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'client_notes' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_onboarding_links' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'payments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'demo_slots' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      when 'demo_bookings' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger demo_slots_assign_tenant before insert on public.demo_slots
  for each row execute function private.assign_tenant();
create trigger demo_bookings_assign_tenant before insert on public.demo_bookings
  for each row execute function private.assign_tenant();

alter table public.demo_slots alter column tenant_id set not null;
alter table public.demo_bookings alter column tenant_id set not null;

alter table public.demo_slots add constraint demo_slots_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.demo_slots add constraint demo_slots_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

alter table public.demo_bookings add constraint demo_bookings_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.demo_bookings add constraint demo_bookings_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.demo_bookings add constraint demo_bookings_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.demo_bookings add constraint demo_bookings_booker_tenant_fkey
  foreign key (booked_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.demo_bookings add constraint demo_bookings_slot_tenant_fkey
  foreign key (slot_id, tenant_id) references public.demo_slots (id, tenant_id) on delete set null (slot_id);

create trigger demo_slots_va_id_role before insert or update of va_id on public.demo_slots
  for each row execute function private.enforce_role('va_id', 'va');
create trigger demo_bookings_va_id_role before insert or update of va_id on public.demo_bookings
  for each row execute function private.enforce_role('va_id', 'va');
create trigger demo_bookings_set_updated_at before update on public.demo_bookings
  for each row execute function private.set_updated_at();

create index demo_slots_tenant_starts_at_idx on public.demo_slots (tenant_id, starts_at);
create index demo_bookings_va_starts_at_idx on public.demo_bookings (va_id, starts_at);
create index demo_bookings_client_created_at_idx on public.demo_bookings (client_id, created_at desc);
create index demo_bookings_tenant_status_starts_at_idx on public.demo_bookings (tenant_id, status, starts_at);
create index demo_bookings_slot_id_idx on public.demo_bookings (slot_id);

-- Helpers (security definer: they read profiles, staff_profiles and bookings the caller can't) --------------

-- A VA who may publish slots and take demos: the same rule as the app's vaPortalOpen() — not deactivated, and
-- their profile approved (or, for a VA from before reviews, an active account without a staff profile).
create function private.va_is_open(va uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    left join public.staff_profiles sp on sp.user_id = p.id
    where r.user_id = va and r.role = 'va' and p.status <> 'inactive'
      and (sp.review_status = 'approved' or (sp.user_id is null and p.status = 'active'))
  );
$$;

create function private.is_open_va() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.va_is_open((select auth.uid()));
$$;

-- The slots a client may book now: in their tenant, at least 4 hours and at most 14 days ahead, of an open VA,
-- and not used by a booking (other than a cancelled one).
create function private.open_slot_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.demo_slots s
  where s.tenant_id = private.tenant_id()
    and s.starts_at >= now() + interval '4 hours' and s.starts_at <= now() + interval '14 days'
    and private.va_is_open(s.va_id)
    and not exists (select 1 from public.demo_bookings b where b.slot_id = s.id and b.status <> 'cancelled');
$$;

-- Whether a slot has a booking other than a cancelled one (a VA can delete only an unused slot).
create function private.slot_in_use(slot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.demo_bookings b where b.slot_id = slot and b.status <> 'cancelled');
$$;

revoke all on function private.va_is_open(uuid), private.is_open_va(), private.open_slot_ids(), private.slot_in_use(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.is_open_va(), private.open_slot_ids(), private.slot_in_use(uuid) to authenticated;

-- Functions (server only) -----------------------------------------------------------------------------------
-- Run with the secret key, so each checks the actor itself: the client's own login books and cancels, the
-- booking's VA decides. They return what the app needs for the email, so it makes no extra reads.
-- IVA01 unknown client, slot or booking · IVA06 client not active · IVA07 client disabled · IVA14 actor not
-- allowed · IVA16 the client already has a VA · IVA17 an open demo already exists · IVA18 slot no longer
-- available · IVA19 too soon or too far ahead · IVA20 the demo can't change any more

create function public.book_demo(client_id uuid, slot_id uuid, actor uuid, note text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
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
  if client.user_id is null or client.user_id is distinct from actor then
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
    left join public.staff_profiles sp on sp.user_id = p.id
    where r.user_id = slot.va_id and r.role = 'va' and p.status <> 'inactive'
      and (sp.review_status = 'approved' or (sp.user_id is null and p.status = 'active'))
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

-- The booking's VA confirms or rejects a request that hasn't started.
create function public.decide_demo(booking_id uuid, actor uuid, decision text, reason text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
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
  if booking.va_id is distinct from actor
    or not exists (select 1 from public.profiles p where p.id = actor and p.status <> 'inactive') then
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

-- The client cancels their own pending or confirmed demo before it starts; the slot frees up.
create function public.cancel_demo(booking_id uuid, actor uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  booking public.demo_bookings%rowtype;
  va_email text;
  va_full_name text;
begin
  select * into booking from public.demo_bookings b where b.id = cancel_demo.booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if not exists (select 1 from public.clients c where c.id = booking.client_id and c.user_id = actor) then
    raise exception 'only the client can cancel their demo' using errcode = 'IVA14';
  end if;
  if booking.status not in ('pending', 'confirmed') or booking.starts_at <= now() then
    raise exception 'this demo is % and can''t be cancelled', booking.status using errcode = 'IVA20';
  end if;

  update public.demo_bookings b set status = 'cancelled', cancelled_at = now() where b.id = booking.id;

  select p.email, p.full_name into va_email, va_full_name from public.profiles p where p.id = booking.va_id;
  return jsonb_build_object('previous_status', booking.status, 'va_email', va_email, 'va_name', va_full_name,
    'company_name', booking.company_name, 'starts_at', booking.starts_at);
end;
$$;

revoke all on function public.book_demo(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.decide_demo(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_demo(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.book_demo(uuid, uuid, uuid, text) to service_role;
grant execute on function public.decide_demo(uuid, uuid, text, text) to service_role;
grant execute on function public.cancel_demo(uuid, uuid) to service_role;

-- Grants and RLS --------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.demo_slots, public.demo_bookings to service_role;
grant select, delete on public.demo_slots to authenticated;
grant insert (va_id, starts_at, ends_at) on public.demo_slots to authenticated;
grant select on public.demo_bookings to authenticated;

alter table public.demo_slots enable row level security;
-- A VA: their own slots · a client: only the slots they may book now · an admin with 2FA: all.
create policy "Read slots by role" on public.demo_slots for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
    or ((select private.has_role('client')) and id in (select private.open_slot_ids()))
  );
-- An open VA publishes their own slots, in the future and at most 30 days ahead…
create policy "Open VAs add their own slots" on public.demo_slots for insert to authenticated
  with check (
    (select private.has_role('va')) and va_id = (select auth.uid()) and (select private.is_open_va())
    and starts_at > now() and starts_at <= now() + interval '30 days'
  );
-- …and deletes one only while it is still ahead and unused.
create policy "VAs delete their own unused slots" on public.demo_slots for delete to authenticated
  using ((select private.has_role('va')) and va_id = (select auth.uid()) and starts_at > now() and not private.slot_in_use(id));
create policy "Own tenant only" on public.demo_slots as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

alter table public.demo_bookings enable row level security;
-- Writes go through the functions above only.
create policy "Read demo bookings by role" on public.demo_bookings for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
    or ((select private.has_role('closer')) and client_id in (select private.created_client_ids()))
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
  );
create policy "Own tenant only" on public.demo_bookings as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
