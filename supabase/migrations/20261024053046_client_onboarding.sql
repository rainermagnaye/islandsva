-- Client onboarding (M3): the link a Closer sends so a client can fill in their details before activation.
-- Tokens are random 256-bit values made by the server; only their SHA-256 is stored. Links are issued, revoked
-- and used only by the server (secret key) through the functions below, which check who may issue a link and
-- whether it is still usable. Signed-in users can read link status (never the hash) and write nothing here.

-- Clients ---------------------------------------------------------------------------------------------------

-- What the client submits: billing details, and when they consented and sent the form. Constant defaults:
-- no rewrite of existing rows. Limits mirror CLIENT_BILLING_LIMITS in features/clients/contract.ts.
alter table public.clients
  add column billing jsonb not null default '{}'::jsonb,
  add column consented_at timestamptz,
  add column onboarding_submitted_at timestamptz,
  add constraint clients_billing_object check (jsonb_typeof(billing) = 'object' and octet_length(billing::text) <= 2000);

-- A Closer or admin may correct billing typos. Consent and submission times are written only by submit_onboarding.
grant update (billing) on public.clients to authenticated;
-- A Closer creates a client with its agreed package in one statement (the package CHECKs still apply).
grant insert (package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone, business) on public.clients to authenticated;
-- From now on this records when the onboarding email was accepted by the mail provider: server-only.
revoke update (registration_email_sent_at) on public.clients from authenticated;

-- Onboarding links ------------------------------------------------------------------------------------------

create table public.client_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  tenant_id uuid,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Fixed lifetime, set here so the app can't choose it.
  expires_at timestamptz not null default now() + interval '7 days',
  submitted_at timestamptz,
  revoked_at timestamptz,
  constraint client_onboarding_links_expiry check (expires_at > created_at),
  constraint client_onboarding_links_used_once check (submitted_at is null or revoked_at is null)
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
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger client_onboarding_links_assign_tenant before insert on public.client_onboarding_links
  for each row execute function private.assign_tenant();

alter table public.client_onboarding_links alter column tenant_id set not null;

alter table public.client_onboarding_links add constraint client_onboarding_links_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.client_onboarding_links add constraint client_onboarding_links_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade;
alter table public.client_onboarding_links add constraint client_onboarding_links_creator_tenant_fkey
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id);

-- Only an active Closer or admin issues links.
create trigger client_onboarding_links_creator_role before insert on public.client_onboarding_links
  for each row execute function private.enforce_role('created_by', 'closer', 'admin');

create index client_onboarding_links_client_created_at_idx on public.client_onboarding_links (client_id, created_at desc);
create index client_onboarding_links_tenant_id_idx on public.client_onboarding_links (tenant_id);
-- At most one usable link per client: issuing a new one revokes the old one first.
create unique index client_onboarding_links_one_open_idx on public.client_onboarding_links (client_id)
  where submitted_at is null and revoked_at is null;

-- Functions (server only) -----------------------------------------------------------------------------------
-- Run with the secret key, which can't see the caller's two-factor level, so each one checks the actor itself:
-- the Closer who created the client, or an active admin of the client's tenant. The app has already checked
-- the session (requireRole) and read the client under RLS before calling.
-- IVA01 unknown client · IVA06 client not pending · IVA07 client disabled · IVA08 unknown link
-- IVA09 link expired · IVA10 link used or revoked · IVA13 a link was issued moments ago · IVA14 actor not allowed

create function public.issue_onboarding_link(client_id uuid, issued_by uuid, token_hash text)
returns table (link_id uuid, link_expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
begin
  if token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'token hash must be 64 hex characters' using errcode = 'check_violation';
  end if;

  select * into client from public.clients c where c.id = issue_onboarding_link.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;
  if client.created_by is distinct from issued_by and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = issued_by and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only the client''s Closer or an admin can send the form' using errcode = 'IVA14';
  end if;
  if client.status <> 'pending' then
    raise exception 'the client is already %', client.status using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'the client is disabled' using errcode = 'IVA07';
  end if;
  -- One email every two minutes at most, so a double click or a script can't flood the client.
  if exists (
    select 1 from public.client_onboarding_links l
    where l.client_id = client.id and l.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'a form was sent moments ago' using errcode = 'IVA13';
  end if;

  update public.client_onboarding_links l set revoked_at = now()
  where l.client_id = client.id and l.submitted_at is null and l.revoked_at is null;

  return query
    insert into public.client_onboarding_links as l (client_id, token_hash, created_by)
    values (client.id, issue_onboarding_link.token_hash, issued_by)
    returning l.id, l.expires_at;
end;
$$;

create function public.revoke_onboarding_link(client_id uuid, revoked_by uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  revoked int;
begin
  select * into client from public.clients c where c.id = revoke_onboarding_link.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;
  if client.created_by is distinct from revoked_by and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = revoked_by and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only the client''s Closer or an admin can revoke the form' using errcode = 'IVA14';
  end if;

  update public.client_onboarding_links l set revoked_at = now()
  where l.client_id = client.id and l.submitted_at is null and l.revoked_at is null;
  get diagnostics revoked = row_count;
  return revoked > 0;
end;
$$;

-- The client's submission, from the public form. Writes their contact, company and billing details and consent,
-- and uses the link up, in one transaction. Never changes the contact email or the company name.
create function public.submit_onboarding(
  token_hash text,
  contact_name text,
  contact_phone text,
  business jsonb,
  billing jsonb,
  consent boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  link public.client_onboarding_links%rowtype;
  client public.clients%rowtype;
begin
  select * into link from public.client_onboarding_links l where l.token_hash = submit_onboarding.token_hash for update;
  if not found then
    raise exception 'unknown link' using errcode = 'IVA08';
  end if;
  if link.submitted_at is not null or link.revoked_at is not null then
    raise exception 'this link was already used or withdrawn' using errcode = 'IVA10';
  end if;
  if link.expires_at <= now() then
    raise exception 'this link has expired' using errcode = 'IVA09';
  end if;

  select * into client from public.clients c where c.id = link.client_id for update;
  if client.status <> 'pending' then
    raise exception 'the client is already %', client.status using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'the client is disabled' using errcode = 'IVA07';
  end if;
  if consent is not true then
    raise exception 'consent is required' using errcode = 'check_violation';
  end if;

  -- Lengths and shapes are enforced by the clients CHECKs (contact name, phone, business, billing).
  update public.clients c set
    contact_name = btrim(submit_onboarding.contact_name),
    contact_phone = nullif(btrim(submit_onboarding.contact_phone), ''),
    business = submit_onboarding.business,
    billing = submit_onboarding.billing,
    consented_at = now(),
    onboarding_submitted_at = now()
  where c.id = client.id;

  update public.client_onboarding_links l set submitted_at = now() where l.id = link.id;
  return client.id;
end;
$$;

revoke all on function public.issue_onboarding_link(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.revoke_onboarding_link(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.submit_onboarding(text, text, text, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
grant execute on function public.issue_onboarding_link(uuid, uuid, text) to service_role;
grant execute on function public.revoke_onboarding_link(uuid, uuid) to service_role;
grant execute on function public.submit_onboarding(text, text, text, jsonb, jsonb, boolean) to service_role;

-- Grants and RLS --------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.client_onboarding_links to service_role;
-- Status only: the token hash stays server-side even for those who may see the link.
grant select (id, client_id, tenant_id, created_by, created_at, expires_at, submitted_at, revoked_at)
  on public.client_onboarding_links to authenticated;

alter table public.client_onboarding_links enable row level security;
create policy "Closers and admins read onboarding links" on public.client_onboarding_links for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and client_id in (select private.created_client_ids()))
  );
create policy "Own tenant only" on public.client_onboarding_links as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
