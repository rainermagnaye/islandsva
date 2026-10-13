-- Admin system: admins (with two-factor sign-in) read and triage leads and convert them into clients.
-- Everyone else still has no access to leads; the contact form keeps inserting with the server key.

-- Leads: read all; change only the triage columns. Contact details and spam metadata stay as submitted.
grant select on public.leads to authenticated;
grant update (status, closer_id, converted_client_id) on public.leads to authenticated;

create policy "Admins read leads" on public.leads for select to authenticated
  using ((select private.is_admin()));
create policy "Admins update leads" on public.leads for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- A lead links to a client only once it is converted (with leads_converted_has_client: both or neither).
alter table public.leads
  add constraint leads_client_only_when_converted check (converted_client_id is null or status = 'converted');

-- Status flow, enforced for every caller (the app follows the same rules in nextStatuses()):
--   new · contacted · qualified → each other, closed, or converted
--   closed → new (reopen) only
--   converted → final: its status and client link never change
-- Errors use IVA04 so the app can tell a refused move from an outage.
create function private.guard_lead_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'converted' then
    raise exception 'a converted lead can''t change' using errcode = 'IVA04';
  end if;
  if old.status = 'closed' and new.status not in ('closed', 'new') then
    raise exception 'a closed lead can only be reopened' using errcode = 'IVA04';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_lead_status() from public, anon, authenticated, service_role;

create trigger leads_guard_status before update of status, converted_client_id on public.leads
  for each row
  when (old.status is distinct from new.status or old.converted_client_id is distinct from new.converted_client_id)
  execute function private.guard_lead_status();

-- Converts a lead into a pending client in one transaction: creates the client from the lead's contact
-- details (company and contact names as confirmed by the admin) and marks the lead converted.
-- SECURITY INVOKER: it runs as the calling admin, so RLS and the column grants apply to every statement.
-- The lead row is locked first, so a double submit or two admins at once can't create two clients.
-- Errors carry their own SQLSTATE so the app can map them to messages:
--   IVA01 lead not found · IVA02 already converted · IVA03 lead is closed.
create function public.convert_lead(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_phone text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  new_client uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;

  select * into lead from public.leads l where l.id = convert_lead.lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.status = 'converted' then
    raise exception 'lead already converted' using errcode = 'IVA02';
  end if;
  if lead.status = 'closed' then
    raise exception 'lead is closed' using errcode = 'IVA03';
  end if;

  insert into public.clients (company_name, contact_name, contact_email, contact_phone, notes, created_by)
  values (convert_lead.company_name, convert_lead.contact_name, lead.email, convert_lead.contact_phone, lead.message, (select auth.uid()))
  returning id into new_client;

  update public.leads l set status = 'converted', converted_client_id = new_client where l.id = lead.id;
  return new_client;
end;
$$;

revoke all on function public.convert_lead(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.convert_lead(uuid, text, text, text) to authenticated;
