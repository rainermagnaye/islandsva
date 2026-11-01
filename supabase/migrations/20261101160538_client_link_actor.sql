-- Registration link: the database checks who creates it.
-- Lead Gens read every client in their agency (20261101223000_closer_tenant_read), and the registration link opens
-- the client's details, agreement and payment proof without a sign-in. issue_client_onboarding_link(uuid, text, text)
-- runs with the secret key and never checks the caller, so the app was the only guard. This adds an overload that
-- names the actor and checks it like issue_onboarding_link: the client's creator, or an active admin (or Super Admin)
-- of the client's agency. Expand only: the three-argument function stays until the app that calls this one is
-- deployed; a later contract migration drops it.
-- IVA06 no such client · IVA14 actor not allowed · IVA09 the client is disabled · IVA07 a link already exists.
create function public.issue_client_onboarding_link(client_id uuid, token text, token_hash text, issued_by uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
begin
  select * into client from public.clients c where c.id = issue_client_onboarding_link.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  -- The actor's profile must be active and in the client's agency: a deactivated creator, or an admin elsewhere, can't.
  if not exists (
    select 1 from public.profiles p
    where p.id = issue_client_onboarding_link.issued_by and p.status <> 'inactive' and p.tenant_id = client.tenant_id
      and (
        client.created_by = p.id
        or exists (select 1 from public.roles r where r.user_id = p.id and r.role in ('admin', 'super_admin'))
      )
  ) then
    raise exception 'only the client''s Closer or an admin can create the registration link' using errcode = 'IVA14';
  end if;
  -- After the actor check, and transaction-local: the audit log names this person for the client update below.
  perform set_config('app.actor', issue_client_onboarding_link.issued_by::text, true);

  if client.disabled_at is not null then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status <> 'ready' then
    raise exception 'onboarding link already exists' using errcode = 'IVA07';
  end if;
  if token !~ '^[A-Za-z0-9_-]{43}$' or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad onboarding token' using errcode = 'check_violation';
  end if;

  insert into public.client_packets (client_id, token, token_hash)
  values (client.id, token, token_hash);

  update public.clients set onboarding_status = 'pending_customer' where id = client.id;
end;
$$;

revoke all on function public.issue_client_onboarding_link(uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.issue_client_onboarding_link(uuid, text, text, uuid) to service_role;
