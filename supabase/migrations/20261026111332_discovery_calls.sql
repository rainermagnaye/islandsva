-- Discovery calls (M8, slice 1): the database side only — no app code reads it yet.
--
-- An admin sets up to 6 times of day (PHT); every day at those times is a 30-minute discovery slot. A visitor
-- requests one on the contact form (server, secret key): the lead, its meeting and the first history row are
-- written in one transaction. Lead Gens (`closer` in code) see open requests in a reduced inbox (no email or
-- spam metadata) and confirm one — which makes them the lead's owner — or reject it with a reason (the lead is
-- closed as junk). After the call the organizer records done or no-show.
--
-- meetings is the one model for every call; only `discovery` exists so far (intro and client↔VA calls arrive in
-- M10 and M12). meeting_events is its append-only history. No cron: request_discovery_call settles unanswered
-- requests whose time has passed (→ expired) before it counts or inserts, like book_demo.
--
-- Lock order, in every function that takes both: the meeting row first, then its lead.

create type public.meeting_kind as enum ('discovery');
create type public.meeting_status as enum ('requested', 'scheduled', 'rejected', 'done', 'no_show', 'cancelled', 'expired');
create type public.meeting_event_kind as enum ('requested', 'scheduled', 'rejected', 'done', 'no_show', 'note', 'expired');

-- Discovery times -------------------------------------------------------------------------------------------

-- A tenant's daily times of day in PHT (Asia/Manila, +08:00 all year — no DST, so a fixed shift is exact and
-- needs no time-zone data). The cap of 6 is the unique position 1–6, so no code path can store a seventh.
create table public.discovery_times (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  position smallint not null check (position between 1 and 6),
  time_of_day time not null,
  created_at timestamptz not null default now(),
  -- On :00 or :30, the same boundaries as the 30-minute meetings below.
  constraint discovery_times_aligned check (extract(minute from time_of_day) in (0, 30) and extract(second from time_of_day) = 0),
  constraint discovery_times_position_key unique (tenant_id, position),
  constraint discovery_times_time_key unique (tenant_id, time_of_day)
);

-- Meetings --------------------------------------------------------------------------------------------------

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  kind public.meeting_kind not null,
  status public.meeting_status not null default 'requested',
  lead_id uuid,
  -- Whose calendar the call is on (M9: the Google event's owner). Set when a Lead Gen confirms.
  organizer_id uuid,
  -- Who confirmed or rejected the request.
  decided_by uuid,
  decided_at timestamptz,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  google_event_id text check (google_event_id is null or char_length(google_event_id) between 1 and 1024), -- null until M9
  -- Only a real Meet link (meet.google.com/abc-defg-hij), so a stored link can't send anyone elsewhere.
  meet_url text check (meet_url is null or meet_url ~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_id_tenant_key unique (id, tenant_id),
  constraint meetings_ends_after_start check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  -- A discovery call belongs to a lead and is a fixed 30-minute slot on :00 or :30.
  constraint meetings_discovery_shape check (
    kind <> 'discovery' or (
      lead_id is not null and ends_at = starts_at + interval '30 minutes'
      and extract(epoch from starts_at)::bigint % 1800 = 0
    )
  ),
  constraint meetings_requested_undecided check (status <> 'requested' or (organizer_id is null and decided_by is null)),
  constraint meetings_decided_pair check ((decided_by is null) = (decided_at is null)),
  constraint meetings_scheduled_has_organizer check (status not in ('scheduled', 'done', 'no_show') or organizer_id is not null),
  constraint meetings_rejected_decided check (status <> 'rejected' or decided_by is not null)
);

-- Open = requested or scheduled. One open discovery call per lead, and one per tenant and start time: with at
-- most 6 times a day that caps the agency at 6 calls a day. These hold even for two requests at the same moment
-- (the loser gets 23505, which the app shows as "slot taken").
create unique index meetings_one_open_discovery_per_lead on public.meetings (lead_id)
  where kind = 'discovery' and status in ('requested', 'scheduled');
create unique index meetings_one_open_discovery_per_start on public.meetings (tenant_id, starts_at)
  where kind = 'discovery' and status in ('requested', 'scheduled');

-- Meeting history -------------------------------------------------------------------------------------------

create table public.meeting_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  meeting_id uuid not null,
  kind public.meeting_event_kind not null,
  -- Null only where no person acted: the visitor's request and the system's expiry.
  actor_id uuid,
  body text check (body is null or char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint meeting_events_actor check (actor_id is not null or kind in ('requested', 'expired')),
  -- A rejection says why; the request and the expiry carry no text (the visitor's message stays on the lead).
  constraint meeting_events_body check (
    (kind <> 'rejected' or body is not null) and (kind not in ('requested', 'expired') or body is null)
  )
);

-- Tenants ---------------------------------------------------------------------------------------------------

-- Every existing case (as in rename_staff_to_employees), plus: discovery times go to the caller's tenant (the
-- admin saving them; the default tenant for a server write), a meeting to its lead's, an event to its meeting's.
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
      when 'discovery_times' then coalesce(private.tenant_id(), private.default_tenant_id())
      when 'meetings' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'meeting_events' then (select m.tenant_id from public.meetings m where m.id = (rec ->> 'meeting_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger discovery_times_assign_tenant before insert on public.discovery_times
  for each row execute function private.assign_tenant();
create trigger meetings_assign_tenant before insert on public.meetings
  for each row execute function private.assign_tenant();
create trigger meeting_events_assign_tenant before insert on public.meeting_events
  for each row execute function private.assign_tenant();

-- Same-tenant references: a meeting can't point at another tenant's lead or people, an event at another
-- tenant's meeting. Restrict keeps history resolvable (users are deactivated, never deleted).
alter table public.meetings add constraint meetings_lead_tenant_fkey
  foreign key (lead_id, tenant_id) references public.leads (id, tenant_id) on delete restrict;
alter table public.meetings add constraint meetings_organizer_tenant_fkey
  foreign key (organizer_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.meetings add constraint meetings_decided_by_tenant_fkey
  foreign key (decided_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.meeting_events add constraint meeting_events_meeting_tenant_fkey
  foreign key (meeting_id, tenant_id) references public.meetings (id, tenant_id) on delete restrict;
alter table public.meeting_events add constraint meeting_events_actor_tenant_fkey
  foreign key (actor_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

-- Only Lead Gens organise, decide and act on discovery calls (M10/M12 widen this for VAs and clients).
create trigger meetings_organizer_id_role before insert or update of organizer_id on public.meetings
  for each row execute function private.enforce_role('organizer_id', 'closer');
create trigger meetings_decided_by_role before insert or update of decided_by on public.meetings
  for each row execute function private.enforce_role('decided_by', 'closer');
create trigger meeting_events_actor_id_role before insert on public.meeting_events
  for each row execute function private.enforce_role('actor_id', 'closer');
create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function private.set_updated_at();

create index meetings_lead_id_idx on public.meetings (lead_id);
create index meetings_organizer_starts_at_idx on public.meetings (organizer_id, starts_at);
create index meetings_decided_by_idx on public.meetings (decided_by);
create index meetings_tenant_status_starts_at_idx on public.meetings (tenant_id, status, starts_at);
create index meeting_events_meeting_created_at_idx on public.meeting_events (meeting_id, created_at);
create index meeting_events_actor_id_idx on public.meeting_events (actor_id);
create index meeting_events_tenant_id_idx on public.meeting_events (tenant_id);
-- request_discovery_call counts open requests per visitor IP hash.
create index leads_ip_hash_idx on public.leads (ip_hash) where ip_hash is not null;

-- History is append-only for every role, the secret key and migrations included: a correction is a new row.
create function private.guard_meeting_events_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'meeting history is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger meeting_events_immutable before update or delete on public.meeting_events
  for each row execute function private.guard_meeting_events_immutable();

-- Leads -----------------------------------------------------------------------------------------------------

-- A lead with a meeting has history too (the restrict foreign key would refuse it anyway; this gives IVA05).
-- Invoker, as before: only admins delete leads, and they read every meeting in their tenant.
create or replace function private.guard_lead_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'new'
    or old.converted_client_id is not null
    or exists (select 1 from public.lead_events e where e.lead_id = old.id)
    or exists (select 1 from public.meetings m where m.lead_id = old.id)
  then
    raise exception 'a lead with history can''t be deleted' using errcode = 'IVA05';
  end if;
  return old;
end;
$$;

-- A Lead Gen's rejection writes the lead's junk remark, so they may author timeline rows too. The insert policy
-- on lead_events is unchanged (admins only): Lead Gens write it only through decide_discovery_call.
drop trigger lead_events_author_role on public.lead_events;
create trigger lead_events_author_role before insert on public.lead_events
  for each row execute function private.enforce_role('author_id', 'admin', 'closer');

-- A lead that is closed, converted or paused can't have its request decided (IVA23), so its open request would
-- hold the slot and count against the visitor until its time passed. Settle it to `expired` at once (with an
-- `expired` event, no actor): meeting_event_kind has no `cancelled`, and nobody answered the request.
-- SECURITY DEFINER (written reason): an admin closes or pauses a lead as `authenticated`, which may not write
-- meetings or their history.
-- Lock order: this runs while the lead row is already locked, the reverse of decide_discovery_call (meeting, then
-- lead). So it never waits for a meeting lock: SKIP LOCKED passes over a request that a Lead Gen is deciding at
-- that moment. That decision then waits for this lead lock, re-reads the lead (closed or paused) and is refused
-- with IVA23, leaving the request open; request_discovery_call settles any such leftover before it checks a slot.
create function private.settle_discovery_on_lead_close() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  with settled as (
    update public.meetings m set status = 'expired'
    where m.id in (
      select o.id from public.meetings o
      where o.lead_id = new.id and o.kind = 'discovery' and o.status = 'requested'
      for update skip locked
    )
    returning m.id
  )
  insert into public.meeting_events (meeting_id, kind) select s.id, 'expired' from settled s;
  return null;
end;
$$;

revoke all on function private.settle_discovery_on_lead_close() from public, anon, authenticated, service_role;

create trigger leads_settle_discovery after update of status, disabled_at on public.leads
  for each row
  when (
    (new.status in ('closed', 'converted') and old.status is distinct from new.status)
    or (old.disabled_at is null and new.disabled_at is not null)
  )
  execute function private.settle_discovery_on_lead_close();

-- Functions -------------------------------------------------------------------------------------------------
-- IVA01 unknown meeting (or not a discovery call) · IVA14 the actor isn't allowed · IVA22 the time isn't an
-- open slot · IVA23 the call can't change now · IVA24 this visitor already has an open request

-- An admin (two-factor) replaces their tenant's times. Invoker: RLS and the column grants apply. The delete
-- names the tenant because a Super Admin's policies pass in every tenant — without it, one save would wipe
-- every agency's times.
create function public.set_discovery_times(times time[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if times is null or array_position(times, null) is not null then
    raise exception 'times are required' using errcode = 'check_violation';
  end if;
  if cardinality(times) > 6 then
    raise exception 'at most 6 discovery times' using errcode = 'check_violation';
  end if;

  delete from public.discovery_times d where d.tenant_id = private.tenant_id();
  insert into public.discovery_times (position, time_of_day)
  select row_number() over (order by t.time_of_day), t.time_of_day from unnest(times) as t(time_of_day);
end;
$$;

-- The bookable starts: each day from today (PHT) through 14 days on, at each of the default tenant's times,
-- 12 hours to 14 days ahead, minus starts with an open discovery call. The single source for the picker and for
-- request_discovery_call, so the list and the booking can't disagree. Invoker, secret key only: the contact
-- form is anonymous, so it reads the default tenant (one tenant today; docs/mvp.md → Tenants in the app).
create function public.open_discovery_slots() returns setof timestamptz
language sql stable security invoker set search_path = '' as $$
  with tenant as (
    select t.id from public.tenants t where t.is_default
  ), starts as (
    -- PHT wall time → UTC: minus 8 hours, read as UTC (independent of the session's time zone).
    select ((((now() at time zone 'UTC') + interval '8 hours')::date + d.day + dt.time_of_day) - interval '8 hours') at time zone 'UTC' as slot_start
    from generate_series(0, 14) as d(day)
    cross join public.discovery_times dt
    join tenant on tenant.id = dt.tenant_id
  )
  select s.slot_start from starts s
  where s.slot_start >= now() + interval '12 hours' and s.slot_start <= now() + interval '14 days'
    and not exists (
      select 1 from public.meetings m join tenant on tenant.id = m.tenant_id join public.leads l on l.id = m.lead_id
      where m.kind = 'discovery' and m.status in ('requested', 'scheduled') and m.starts_at = s.slot_start
        -- A request left open on a closed, converted or paused lead (see settle_discovery_on_lead_close) doesn't
        -- hold its start: request_discovery_call settles it before booking.
        and not (m.status = 'requested' and (l.status in ('closed', 'converted') or l.disabled_at is not null))
    )
  order by s.slot_start;
$$;

-- The contact form's request: the lead, its discovery meeting and the 'requested' history row, in one
-- transaction. Returns the lead id (the team email follows it, as for a plain enquiry).
create function public.request_discovery_call(
  full_name text,
  email text,
  company_name text,
  industry text,
  country text,
  message text,
  package_code text,
  ip_hash text,
  user_agent text,
  starts_at timestamptz
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  tenant uuid;
  new_lead uuid;
  new_meeting uuid;
begin
  if request_discovery_call.email is null or request_discovery_call.starts_at is null then
    raise exception 'email and time are required' using errcode = 'check_violation';
  end if;
  select t.id into tenant from public.tenants t where t.is_default;

  -- Serialise requests from the same email and the same IP, so two at once can't both pass the caps below.
  -- Always email (class 1) before IP (class 2), so two requests can't wait on each other.
  perform pg_advisory_xact_lock(1, hashtext(lower(request_discovery_call.email)));
  if request_discovery_call.ip_hash is not null then
    perform pg_advisory_xact_lock(2, hashtext(request_discovery_call.ip_hash));
  end if;

  -- Settle (no cron): this visitor's requests nobody answered before their time, so they no longer count against
  -- them; and any request still open on a closed, converted or paused lead (one the lead trigger skipped while
  -- it was being decided), so it no longer holds its start.
  with settled as (
    update public.meetings m set status = 'expired'
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested'
      and m.lead_id in (
        select l.id from public.leads l
        where l.tenant_id = tenant and (
          (m.starts_at <= now() and (l.email = request_discovery_call.email or l.ip_hash = request_discovery_call.ip_hash))
          or l.status in ('closed', 'converted') or l.disabled_at is not null
        )
      )
    returning m.id
  )
  insert into public.meeting_events (meeting_id, kind) select s.id, 'expired' from settled s;

  if not exists (select 1 from public.open_discovery_slots() as s(slot_start) where s.slot_start = request_discovery_call.starts_at) then
    raise exception 'this time is not open' using errcode = 'IVA22';
  end if;

  -- Slot squatting: one open request per email and two per IP, or a visitor could hold every slot.
  if exists (
    select 1 from public.meetings m join public.leads l on l.id = m.lead_id
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.email = request_discovery_call.email
  ) or (
    request_discovery_call.ip_hash is not null and (
      select count(*) from public.meetings m join public.leads l on l.id = m.lead_id
      where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.ip_hash = request_discovery_call.ip_hash
    ) >= 2
  ) then
    raise exception 'this visitor already has an open request' using errcode = 'IVA24';
  end if;

  insert into public.leads as l (full_name, email, company_name, industry, country, message, package_code, ip_hash, user_agent)
  values (request_discovery_call.full_name, request_discovery_call.email, request_discovery_call.company_name,
    request_discovery_call.industry, request_discovery_call.country, request_discovery_call.message,
    request_discovery_call.package_code, request_discovery_call.ip_hash, request_discovery_call.user_agent)
  returning l.id into new_lead;

  insert into public.meetings as m (kind, lead_id, starts_at, ends_at)
  values ('discovery', new_lead, request_discovery_call.starts_at, request_discovery_call.starts_at + interval '30 minutes')
  returning m.id into new_meeting;

  insert into public.meeting_events (meeting_id, kind) values (new_meeting, 'requested');
  return new_lead;
end;
$$;

-- A Lead Gen confirms ('scheduled': they organise the call and own the lead if it has no owner yet) or rejects
-- it with a reason (the lead is closed, with the reason as its junk remark). Secret key only, so it checks the
-- actor itself. Returns what the confirmation email needs.
create function public.decide_discovery_call(
  meeting_id uuid,
  actor uuid,
  decision text,
  reason text,
  google_event_id text default null,
  meet_url text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  clean_reason text := nullif(btrim(reason), '');
begin
  -- Lock order: the meeting, then its lead.
  select * into meeting from public.meetings m where m.id = decide_discovery_call.meeting_id for update;
  if not found or meeting.kind <> 'discovery' then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  select * into lead from public.leads l where l.id = meeting.lead_id for update;

  -- An active Lead Gen of the meeting's tenant (a deactivated login's token keeps its role for up to an hour),
  -- and not someone else's lead.
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor and r.role = 'closer' and r.tenant_id = meeting.tenant_id and p.status <> 'inactive'
  ) or (lead.closer_id is not null and lead.closer_id is distinct from actor) then
    raise exception 'only an active Lead Gen of this agency can decide this call' using errcode = 'IVA14';
  end if;
  -- Who acted, for the audit log (slice 2): the secret key has no auth.uid(). Transaction-local.
  perform set_config('app.actor', actor::text, true);
  if decision is null or decision not in ('scheduled', 'rejected') then
    raise exception 'decision must be scheduled or rejected' using errcode = 'check_violation';
  end if;
  if meeting.status <> 'requested' or meeting.starts_at <= now()
    or lead.disabled_at is not null or lead.status in ('closed', 'converted') then
    raise exception 'this call is % and can''t be decided', meeting.status using errcode = 'IVA23';
  end if;

  if decision = 'scheduled' then
    update public.meetings m set status = 'scheduled', organizer_id = actor, decided_by = actor, decided_at = now(),
      google_event_id = decide_discovery_call.google_event_id, meet_url = decide_discovery_call.meet_url
    where m.id = meeting.id;
    insert into public.meeting_events (meeting_id, kind, actor_id) values (meeting.id, 'scheduled', actor);
    if lead.closer_id is null then
      update public.leads l set closer_id = actor where l.id = lead.id;
    end if;
  else
    if clean_reason is null or char_length(clean_reason) > 300 then
      raise exception 'a reason of 1 to 300 characters is required' using errcode = 'check_violation';
    end if;
    update public.meetings m set status = 'rejected', decided_by = actor, decided_at = now() where m.id = meeting.id;
    insert into public.meeting_events (meeting_id, kind, actor_id, body) values (meeting.id, 'rejected', actor, clean_reason);
    update public.leads l set status = 'closed' where l.id = lead.id;
    insert into public.lead_events (lead_id, author_id, kind, body) values (lead.id, actor, 'junk', clean_reason);
  end if;

  return jsonb_build_object('lead_id', lead.id, 'status', decision, 'starts_at', meeting.starts_at,
    'email', lead.email, 'full_name', lead.full_name);
end;
$$;

-- The call's organizer records how it went, once it has started. A held call moves a new lead to contacted
-- (unless the lead is paused, as for record_lead_step).
create function public.record_discovery_outcome(meeting_id uuid, actor uuid, outcome text, note text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  clean_note text := nullif(btrim(note), '');
begin
  -- Lock order: the meeting, then its lead.
  select * into meeting from public.meetings m where m.id = record_discovery_outcome.meeting_id for update;
  if not found or meeting.kind <> 'discovery' then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  select * into lead from public.leads l where l.id = meeting.lead_id for update;

  if meeting.organizer_id is distinct from actor or not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor and r.role = 'closer' and r.tenant_id = meeting.tenant_id and p.status <> 'inactive'
  ) then
    raise exception 'only the call''s organizer can record its outcome' using errcode = 'IVA14';
  end if;
  perform set_config('app.actor', actor::text, true);
  if outcome is null or outcome not in ('done', 'no_show') then
    raise exception 'outcome must be done or no_show' using errcode = 'check_violation';
  end if;
  if meeting.status <> 'scheduled' or meeting.starts_at > now() then
    raise exception 'this call is % and its outcome can''t be recorded now', meeting.status using errcode = 'IVA23';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'notes are at most 1000 characters' using errcode = 'check_violation';
  end if;

  update public.meetings m set status = outcome::public.meeting_status where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, body)
  values (meeting.id, outcome::public.meeting_event_kind, actor, clean_note);
  if outcome = 'done' and lead.status = 'new' and lead.disabled_at is null then
    update public.leads l set status = 'contacted' where l.id = lead.id;
  end if;
end;
$$;

-- The Lead Gens' shared inbox: open requests in the caller's tenant, in a reduced form.
-- SECURITY DEFINER (written reason): it shows leads nobody owns yet, which the leads policy rightly hides from a
-- Lead Gen. So it returns only what deciding needs — never the email, profile, IP hash, user agent or
-- notified_at — and checks the caller in the database, not just the token: they hold `closer` in their own
-- tenant and aren't deactivated (a deactivated login's token keeps its roles for up to an hour). Anyone else
-- gets no rows. The email reaches a Lead Gen only once they confirm (decide_discovery_call returns it).
create function public.discovery_inbox() returns table (
  meeting_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  full_name text,
  company_name text,
  industry text,
  country text,
  package_code text,
  message text
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.starts_at, m.ends_at, l.full_name, l.company_name, l.industry, l.country, l.package_code, l.message
  from public.meetings m join public.leads l on l.id = m.lead_id
  where exists (
      select 1 from public.roles r join public.profiles p on p.id = r.user_id
      where r.user_id = (select auth.uid()) and r.role = 'closer' and r.tenant_id = (select private.tenant_id())
        and p.status <> 'inactive'
    )
    and m.tenant_id = (select private.tenant_id())
    and m.kind = 'discovery' and m.status = 'requested' and m.starts_at > now()
    -- Only what the caller could still decide (decide_discovery_call's IVA14 and IVA23 rules).
    and l.disabled_at is null and l.status not in ('closed', 'converted')
    and (l.closer_id is null or l.closer_id = (select auth.uid()))
  order by m.starts_at;
$$;

revoke all on function public.set_discovery_times(time[]) from public, anon, authenticated, service_role;
revoke all on function public.open_discovery_slots() from public, anon, authenticated, service_role;
revoke all on function public.request_discovery_call(text, text, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.decide_discovery_call(uuid, uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.record_discovery_outcome(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.discovery_inbox() from public, anon, authenticated, service_role;
revoke all on function private.guard_meeting_events_immutable() from public, anon, authenticated, service_role;
grant execute on function public.set_discovery_times(time[]) to authenticated;
grant execute on function public.open_discovery_slots() to service_role;
grant execute on function public.request_discovery_call(text, text, text, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.decide_discovery_call(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.record_discovery_outcome(uuid, uuid, text, text) to service_role;
grant execute on function public.discovery_inbox() to authenticated;

-- Grants and RLS --------------------------------------------------------------------------------------------
-- tenant_id is in no authenticated grant. Meetings are never deleted (history); their events never change.

grant select, insert, update, delete on public.discovery_times to service_role;
grant select, delete on public.discovery_times to authenticated;
grant insert (position, time_of_day) on public.discovery_times to authenticated;
grant select, insert, update on public.meetings to service_role;
grant select on public.meetings to authenticated;
grant select, insert on public.meeting_events to service_role;
grant select on public.meeting_events to authenticated;

alter table public.discovery_times enable row level security;
create policy "Admins read discovery times" on public.discovery_times for select to authenticated
  using ((select private.is_admin()));
create policy "Admins add discovery times" on public.discovery_times for insert to authenticated
  with check ((select private.is_admin()));
create policy "Admins delete discovery times" on public.discovery_times for delete to authenticated
  using ((select private.is_admin()));
create policy "Own tenant only" on public.discovery_times as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

alter table public.meetings enable row level security;
-- An admin with 2FA: all · a Lead Gen: the calls they organise or decided. Open requests reach Lead Gens only
-- through discovery_inbox(). Writes go through the functions above.
create policy "Read meetings by role" on public.meetings for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and (organizer_id = (select auth.uid()) or decided_by = (select auth.uid())))
  );
create policy "Own tenant only" on public.meetings as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

alter table public.meeting_events enable row level security;
-- A meeting's history is visible to whoever may see the meeting (the subquery runs under meetings' policies).
create policy "Read meeting history with the meeting" on public.meeting_events for select to authenticated
  using (meeting_id in (select m.id from public.meetings m));
create policy "Own tenant only" on public.meeting_events as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Leads: one select policy (several permissive ones would each run per row). Admins with 2FA as before; a Lead
-- Gen reads the leads they own. The select grant is table-wide, so an owner can read ip_hash and user_agent
-- too — column grants come with the lead handover (slice 6); the app selects explicit columns.
drop policy "Admins read leads" on public.leads;
create policy "Read leads by role" on public.leads for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and closer_id = (select auth.uid()))
  );
