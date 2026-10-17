-- A lead's timeline: call summaries, qualification, conversion and junk remarks, plus notes the admin adds.
-- Status still lives only on leads. disabled_at pauses the pipeline without inventing a second status.
-- Delete stays possible only while the lead is still new and has no timeline rows (enforced by the trigger).

-- Safe to run again: an earlier run may already have created the type.
do $$ begin
  create type public.lead_event_kind as enum ('call', 'qualification', 'conversion', 'junk', 'note', 'remark');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  kind public.lead_event_kind not null,
  body text not null check (char_length(body) between 1 and 2000),
  tenant_id uuid,
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists disabled_at timestamptz;

-- Extra profile fields the overview edits (job title, address, preferences). Core columns stay as they are.
alter table public.leads add column if not exists profile jsonb not null default '{}'::jsonb
  check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 4000);

-- Same-tenant link. id is already unique; (id, tenant_id) lets the timeline point at the lead and its tenant together.
do $$ begin
  alter table public.leads add constraint leads_id_tenant_key unique (id, tenant_id);
exception
  when duplicate_object or duplicate_table then null;
end $$;

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
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_events_assign_tenant on public.lead_events;
create trigger lead_events_assign_tenant before insert on public.lead_events
  for each row execute function private.assign_tenant();

alter table public.lead_events alter column tenant_id set not null;

do $$ begin
  alter table public.lead_events add constraint lead_events_tenant_id_fkey
    foreign key (tenant_id) references public.tenants (id) on delete restrict;
exception
  when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.lead_events add constraint lead_events_lead_tenant_fkey
    foreign key (lead_id, tenant_id) references public.leads (id, tenant_id) on delete cascade;
exception
  when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.lead_events add constraint lead_events_author_tenant_fkey
    foreign key (author_id, tenant_id) references public.profiles (id, tenant_id);
exception
  when duplicate_object or duplicate_table then null;
end $$;
drop trigger if exists lead_events_author_role on public.lead_events;
create trigger lead_events_author_role before insert on public.lead_events
  for each row execute function private.enforce_role('author_id', 'admin');

create index if not exists lead_events_lead_created_at_idx on public.lead_events (lead_id, created_at desc);
create index if not exists lead_events_tenant_id_idx on public.lead_events (tenant_id);

-- History is append-only. A lead that was worked (or is no longer new) cannot be removed.
create or replace function private.guard_lead_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'new'
    or old.converted_client_id is not null
    or exists (select 1 from public.lead_events e where e.lead_id = old.id)
  then
    raise exception 'a lead with history can''t be deleted' using errcode = 'IVA05';
  end if;
  return old;
end;
$$;

revoke all on function private.guard_lead_delete() from public, anon, authenticated, service_role;

drop trigger if exists leads_guard_delete on public.leads;
create trigger leads_guard_delete before delete on public.leads
  for each row execute function private.guard_lead_delete();

-- One transaction for a pipeline step and its timeline row. Notes and remarks do not move the status.
-- IVA01 unknown lead · IVA04 the step does not fit the lead's current status (including while disabled).
create or replace function public.record_lead_step(lead_id uuid, kind public.lead_event_kind, body text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  next_status public.lead_status;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if body is null or char_length(btrim(body)) < 1 or char_length(body) > 2000 then
    raise exception 'remarks are required' using errcode = 'check_violation';
  end if;

  select * into lead from public.leads l where l.id = record_lead_step.lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.disabled_at is not null and kind not in ('note', 'remark') then
    raise exception 'this lead is disabled' using errcode = 'IVA04';
  end if;

  next_status := case
    when kind in ('note', 'remark') then lead.status
    when kind = 'call' and lead.status = 'new' then 'contacted'
    when kind = 'qualification' and lead.status = 'contacted' then 'qualified'
    when kind = 'junk' and lead.status in ('new', 'contacted', 'qualified') then 'closed'
    else null
  end;
  if next_status is null then
    raise exception 'that step is not available for this lead' using errcode = 'IVA04';
  end if;

  insert into public.lead_events (lead_id, author_id, kind, body)
  values (lead.id, (select auth.uid()), kind, btrim(body));

  if next_status is distinct from lead.status then
    update public.leads l set status = next_status where l.id = lead.id;
  end if;
end;
$$;

revoke all on function public.record_lead_step(uuid, public.lead_event_kind, text) from public, anon, authenticated, service_role;
grant execute on function public.record_lead_step(uuid, public.lead_event_kind, text) to authenticated;

-- Conversion plus the remark, in the same transaction as convert_lead.
create or replace function public.convert_lead_noted(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_phone text,
  remarks text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  new_client uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if remarks is null or char_length(btrim(remarks)) < 1 or char_length(remarks) > 2000 then
    raise exception 'remarks are required' using errcode = 'check_violation';
  end if;

  select * into lead from public.leads l where l.id = convert_lead_noted.lead_id;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.disabled_at is not null then
    raise exception 'this lead is disabled' using errcode = 'IVA04';
  end if;

  new_client := public.convert_lead(convert_lead_noted.lead_id, convert_lead_noted.company_name, convert_lead_noted.contact_name, convert_lead_noted.contact_phone);

  insert into public.lead_events (lead_id, author_id, kind, body)
  values (convert_lead_noted.lead_id, (select auth.uid()), 'conversion', btrim(remarks));
  return new_client;
end;
$$;

revoke all on function public.convert_lead_noted(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.convert_lead_noted(uuid, text, text, text, text) to authenticated;

grant select, insert, update, delete on public.lead_events to service_role;
grant select, insert (lead_id, author_id, kind, body) on public.lead_events to authenticated;
grant update (full_name, email, company_name, industry, country, message, package_code, disabled_at, profile) on public.leads to authenticated;
grant delete on public.leads to authenticated;

alter table public.lead_events enable row level security;
drop policy if exists "Admins read lead events" on public.lead_events;
create policy "Admins read lead events" on public.lead_events for select to authenticated
  using ((select private.is_admin()));
drop policy if exists "Admins add lead events" on public.lead_events;
create policy "Admins add lead events" on public.lead_events for insert to authenticated
  with check ((select private.is_admin()) and author_id = (select auth.uid()));
drop policy if exists "Own tenant only" on public.lead_events;
create policy "Own tenant only" on public.lead_events as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
drop policy if exists "Admins delete untouched leads" on public.leads;
create policy "Admins delete untouched leads" on public.leads for delete to authenticated
  using ((select private.is_admin()));
