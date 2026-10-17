-- Optional file on a call summary. Bytes stay on the timeline row; the signed-in role can insert them
-- only through record_lead_call, and only up to 2 MB (the same cap as a résumé, inside the 3 MB action limit).

alter table public.lead_events
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_bytes bytea;

do $$ begin
  alter table public.lead_events add constraint lead_events_attachment_check check (
    (attachment_name is null and attachment_type is null and attachment_bytes is null)
    or (
      attachment_name is not null
      and attachment_type is not null
      and attachment_bytes is not null
      and char_length(attachment_name) between 1 and 200
      and attachment_type in (
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf', 'image/jpeg', 'image/png'
      )
      and octet_length(attachment_bytes) between 1 and 2097152
    )
  );
exception
  when duplicate_object then null;
end $$;

grant insert (attachment_name, attachment_type, attachment_bytes) on public.lead_events to authenticated;

-- A contacted step with an optional file, in the same insert as the summary. Empty base64 means no file.
create or replace function public.record_lead_call(
  lead_id uuid,
  body text,
  attachment_name text,
  attachment_type text,
  attachment_base64 text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  bytes bytea;
  stored_name text;
  new_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if body is null or char_length(btrim(body)) < 1 or char_length(body) > 2000 then
    raise exception 'remarks are required' using errcode = 'check_violation';
  end if;

  select * into lead from public.leads l where l.id = record_lead_call.lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.disabled_at is not null or lead.status <> 'new' then
    raise exception 'that step is not available for this lead' using errcode = 'IVA04';
  end if;

  if attachment_base64 is null or btrim(attachment_base64) = '' then
    bytes := null;
    stored_name := null;
    attachment_type := null;
  else
    bytes := decode(attachment_base64, 'base64');
    stored_name := btrim(attachment_name);
    if bytes is null
      or octet_length(bytes) < 1
      or octet_length(bytes) > 2097152
      or stored_name is null
      or char_length(stored_name) not between 1 and 200
      or attachment_type not in (
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf', 'image/jpeg', 'image/png'
      )
    then
      raise exception 'attachment is too large' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.lead_events (lead_id, author_id, kind, body, attachment_name, attachment_type, attachment_bytes)
  values (lead.id, (select auth.uid()), 'call', btrim(body), stored_name, attachment_type, bytes)
  returning id into new_id;

  update public.leads l set status = 'contacted' where l.id = lead.id;
  return new_id;
end;
$$;

revoke all on function public.record_lead_call(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_lead_call(uuid, text, text, text, text) to authenticated;
