-- An admin assigns the client's VA before activation (2026-11-09).
--
-- Until now an assignment came only from the client accepting a shortlist offer, which needs an active company, so a
-- client signed in for the first time with nobody to work with. Now an admin with two-factor assigns the VA once the
-- registration is approved, and activation waits for it:
--
-- * assign_client_va(client_id, va_id): signed-in admin only. The client must be enabled, in the admin's agency (or any,
--   for a Super Admin), have a package, and be approved, invited or active; the VA open and in the same agency, not
--   already on this client; and the package not already fully staffed (one VA for Essentials and Executive, two for
--   Day and night). Once it is, open shortlist offers for the client are withdrawn: there is nothing left to choose.
-- * record_client_invite (the Send activation step) refuses until the package's VAs are assigned (IVA50). Re-created
--   from 20261024045856_client_review with that one check added; same signature, grants and other refusals.
--
-- The VA count per package is written out in both functions and in the app (vasForPackage in
-- features/clients/assistants.ts); change all three together. Expand only: a new function and a stricter existing one.

create function public.assign_client_va(client_id uuid, va_id uuid)
returns uuid
-- Security definer: signed-in users have no insert grant on client_va_assignments. It checks the caller itself, and
-- the role setting keeps its value here, so guard_assignment still sees a signed-in insert and needs the flag below.
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  wanted integer;
  active_count integer;
  assignment uuid;
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' or not (select private.is_admin()) then
    raise exception 'only an admin with two-factor can assign a VA' using errcode = '42501';
  end if;

  select * into client from public.clients c where c.id = assign_client_va.client_id for update;
  if not found or (client.tenant_id is distinct from (select private.tenant_id()) and not (select private.is_super_admin())) then
    raise exception 'client not found' using errcode = 'IVA01';
  end if;

  if client.disabled_at is not null
    or client.package_code is null
    or not (client.status = 'active' or (client.status = 'pending' and client.onboarding_status in ('approved', 'invite_sent')))
    or not (select private.va_is_open(assign_client_va.va_id))
    or not exists (select 1 from public.profiles p where p.id = assign_client_va.va_id and p.tenant_id = client.tenant_id)
    or exists (
      select 1 from public.client_va_assignments a
      where a.client_id = client.id and a.va_id = assign_client_va.va_id and a.status = 'active'
    )
  then
    raise exception 'this VA cannot be assigned to this client' using errcode = 'IVA49';
  end if;

  wanted := case when client.package_code = 'day-and-night' then 2 else 1 end;
  select count(*) into active_count from public.client_va_assignments a where a.client_id = client.id and a.status = 'active';
  if active_count >= wanted then
    raise exception 'this client already has the VAs their package includes' using errcode = 'IVA49';
  end if;

  -- The accept path's flag (guard_assignment), cleared right after this one insert.
  perform set_config('islandsva.shortlist_accept', 'on', true);
  insert into public.client_va_assignments (client_id, va_id, assigned_by)
  values (client.id, assign_client_va.va_id, (select auth.uid()))
  returning id into assignment;
  perform set_config('islandsva.shortlist_accept', '', true);

  if active_count + 1 >= wanted then
    delete from public.va_shortlists s where s.client_id = client.id and s.status = 'offered';
  end if;

  return assignment;
end;
$$;

revoke all on function public.assign_client_va(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.assign_client_va(uuid, uuid) to authenticated;

create or replace function public.record_client_invite(client_id uuid, user_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
begin
  select * into client from public.clients c where c.id = record_client_invite.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null or client.status <> 'pending' then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.user_id is not null then
    raise exception 'client already has a login' using errcode = 'IVA07';
  end if;
  if client.onboarding_status <> 'approved' then
    raise exception 'registration is not ready to activate' using errcode = 'IVA08';
  end if;
  if record_client_invite.user_id is null then
    raise exception 'client login is missing' using errcode = 'check_violation';
  end if;
  -- New (20261109111500_admin_va_assignment): the client signs in to the VAs their package includes.
  if (
    select count(*) from public.client_va_assignments a where a.client_id = client.id and a.status = 'active'
  ) < (case when client.package_code = 'day-and-night' then 2 else 1 end) then
    raise exception 'assign the client''s VA before activation' using errcode = 'IVA50';
  end if;

  update public.clients set
    user_id = record_client_invite.user_id,
    onboarding_status = 'invite_sent'
  where clients.id = client.id;
end;
$$;
