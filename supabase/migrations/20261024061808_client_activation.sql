-- Client activation (M3): payments recorded by hand, and activation once the client has sent the onboarding
-- form, consented and paid. M4 adds Stripe to the same payments table (new provider and statuses); the
-- activation rule stays. The client's login is created by the server at activation, never before.

-- Payments --------------------------------------------------------------------------------------------------

create type public.payment_provider as enum ('manual');
create type public.payment_status as enum ('paid', 'void');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  tenant_id uuid,
  provider public.payment_provider not null default 'manual',
  status public.payment_status not null default 'paid',
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  currency text not null default 'USD' check (currency = 'USD'),
  term_months smallint not null check (term_months in (1, 6, 12)),
  -- The bank or transfer reference for a manual payment; the provider's id from M4.
  provider_ref text check (provider_ref is null or char_length(provider_ref) between 1 and 200),
  paid_on date not null,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  constraint payments_manual_recorded check (provider <> 'manual' or recorded_by is not null),
  constraint payments_void_consistent check ((status = 'void') = (voided_at is not null) and (voided_at is null or voided_by is not null))
);

-- Inherit the client's tenant. The previous cases stay as they are.
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
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger payments_assign_tenant before insert on public.payments
  for each row execute function private.assign_tenant();

alter table public.payments alter column tenant_id set not null;

alter table public.payments add constraint payments_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
-- Payments are money records: a client with payments can't be deleted.
alter table public.payments add constraint payments_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.payments add constraint payments_recorder_tenant_fkey
  foreign key (recorded_by, tenant_id) references public.profiles (id, tenant_id);
alter table public.payments add constraint payments_voider_tenant_fkey
  foreign key (voided_by, tenant_id) references public.profiles (id, tenant_id);

create trigger payments_recorder_role before insert or update of recorded_by on public.payments
  for each row execute function private.enforce_role('recorded_by', 'closer', 'admin');
create trigger payments_voider_role before insert or update of voided_by on public.payments
  for each row execute function private.enforce_role('voided_by', 'closer', 'admin');

create index payments_client_created_at_idx on public.payments (client_id, created_at desc);
create index payments_tenant_id_idx on public.payments (tenant_id);

-- Roles -----------------------------------------------------------------------------------------------------

-- An active Closer may grant the client role, and only that, inside their tenant: they activate the clients they
-- onboard. Every other rule stays: only a Super Admin grants admin or super_admin; an admin grants inside their tenant.
create or replace function private.guard_role_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_by is null or exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = new.assigned_by and r.role = 'super_admin' and p.status <> 'inactive'
  ) then
    return new;
  end if;
  if new.role in ('admin', 'super_admin') then
    raise exception 'only a Super Admin grants the % role', new.role using errcode = 'insufficient_privilege';
  end if;
  if new.role = 'client' and exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = new.assigned_by and r.role = 'closer' and r.tenant_id = new.tenant_id and p.status <> 'inactive'
  ) then
    return new;
  end if;
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = new.assigned_by and r.role = 'admin' and r.tenant_id = new.tenant_id and p.status <> 'inactive'
  ) then
    raise exception 'roles are granted by an admin of the same tenant' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Functions (server only) -----------------------------------------------------------------------------------
-- Run with the secret key, which can't see the caller's two-factor level, so each one checks the actor itself:
-- the Closer who created the client, or an active admin of the client's tenant. The app has already checked
-- the session (requireRole) and read the client under RLS before calling.
-- IVA01 unknown client or payment · IVA06 client not pending · IVA07 client disabled · IVA11 onboarding form not
-- complete · IVA12 no payment recorded · IVA14 actor not allowed · IVA15 the login already belongs to someone

create function public.record_manual_payment(client_id uuid, recorded_by uuid, amount_cents integer, provider_ref text, paid_on date)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  new_id uuid;
begin
  select * into client from public.clients c where c.id = record_manual_payment.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;
  if client.created_by is distinct from recorded_by and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = recorded_by and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only the client''s Closer or an admin can record a payment' using errcode = 'IVA14';
  end if;
  if client.status <> 'pending' then
    raise exception 'the client is already %', client.status using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'the client is disabled' using errcode = 'IVA07';
  end if;
  if client.term_months is null then
    raise exception 'set the client''s package before recording a payment' using errcode = 'check_violation';
  end if;
  if paid_on is null or paid_on > current_date then
    raise exception 'the payment date can''t be in the future' using errcode = 'check_violation';
  end if;

  insert into public.payments as pay (client_id, provider, status, amount_cents, term_months, provider_ref, paid_on, recorded_by)
  values (client.id, 'manual', 'paid', amount_cents, client.term_months, nullif(btrim(provider_ref), ''), paid_on, recorded_by)
  returning pay.id into new_id;
  return new_id;
end;
$$;

-- A payment marked by mistake. Only before activation: after it, a payment is part of the client's history.
create function public.void_payment(payment_id uuid, voided_by uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  payment public.payments%rowtype;
  client public.clients%rowtype;
begin
  select * into payment from public.payments pay where pay.id = void_payment.payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = 'IVA01';
  end if;
  select * into client from public.clients c where c.id = payment.client_id for update;
  if client.created_by is distinct from voided_by and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = voided_by and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only the client''s Closer or an admin can void a payment' using errcode = 'IVA14';
  end if;
  if client.status <> 'pending' then
    raise exception 'the client is already %', client.status using errcode = 'IVA06';
  end if;
  if payment.status <> 'paid' then
    raise exception 'this payment is already void' using errcode = 'check_violation';
  end if;

  update public.payments pay set status = 'void', voided_at = now(), voided_by = void_payment.voided_by where pay.id = payment.id;
end;
$$;

-- Activation: the server has just created the client's login (a fresh, invited account) and passes it in.
-- In one transaction: grant the client role, link the login, mark the client active, and close any open link.
create function public.activate_client(client_id uuid, user_id uuid, activated_by uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  login public.profiles%rowtype;
begin
  select * into client from public.clients c where c.id = activate_client.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;
  if client.created_by is distinct from activated_by and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = activated_by and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only the client''s Closer or an admin can activate the client' using errcode = 'IVA14';
  end if;
  if client.status <> 'pending' then
    raise exception 'the client is already %', client.status using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'the client is disabled' using errcode = 'IVA07';
  end if;
  if client.onboarding_submitted_at is null or client.consented_at is null then
    raise exception 'the client hasn''t sent the onboarding form yet' using errcode = 'IVA11';
  end if;
  if not exists (select 1 from public.payments pay where pay.client_id = client.id and pay.status = 'paid') then
    raise exception 'record a payment before activating' using errcode = 'IVA12';
  end if;

  select * into login from public.profiles p where p.id = activate_client.user_id for update;
  if not found then
    raise exception 'login not found' using errcode = 'IVA01';
  end if;
  -- Only a fresh account: never turn a staff member, or another client's login, into this client.
  if exists (select 1 from public.roles r where r.user_id = login.id)
    or exists (select 1 from public.clients c where c.user_id = login.id)
  then
    raise exception 'this login already belongs to someone' using errcode = 'IVA15';
  end if;
  -- New accounts start in the default tenant; move this one to the client's (a no-op with one tenant).
  if login.tenant_id <> client.tenant_id then
    update public.profiles p set tenant_id = client.tenant_id where p.id = login.id;
  end if;

  insert into public.roles (user_id, role, assigned_by) values (login.id, 'client', activated_by);
  update public.clients c set user_id = login.id, status = 'active', activated_at = now() where c.id = client.id;
  update public.client_onboarding_links l set revoked_at = now()
  where l.client_id = client.id and l.submitted_at is null and l.revoked_at is null;
end;
$$;

revoke all on function public.record_manual_payment(uuid, uuid, integer, text, date) from public, anon, authenticated, service_role;
revoke all on function public.void_payment(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.activate_client(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_manual_payment(uuid, uuid, integer, text, date) to service_role;
grant execute on function public.void_payment(uuid, uuid) to service_role;
grant execute on function public.activate_client(uuid, uuid, uuid) to service_role;

-- Grants and RLS --------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.payments to service_role;
grant select on public.payments to authenticated;

alter table public.payments enable row level security;
create policy "Read payments by role" on public.payments for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and client_id in (select private.created_client_ids()))
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
  );
create policy "Own tenant only" on public.payments as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
