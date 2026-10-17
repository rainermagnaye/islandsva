-- A note can carry the same optional file as a call summary. Notes do not move the lead's status.

create or replace function public.record_lead_note(
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

  select * into lead from public.leads l where l.id = record_lead_note.lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
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
  values (lead.id, (select auth.uid()), 'note', btrim(body), stored_name, attachment_type, bytes)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.record_lead_note(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_lead_note(uuid, text, text, text, text) to authenticated;
