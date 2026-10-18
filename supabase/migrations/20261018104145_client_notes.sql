-- Notes on a client, with an optional file. Append-only: admins read and add their own rows.

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  attachment_name text,
  attachment_type text,
  attachment_bytes bytea,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  constraint client_notes_attachment_check check (
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
  )
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
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger client_notes_assign_tenant before insert on public.client_notes
  for each row execute function private.assign_tenant();

alter table public.client_notes alter column tenant_id set not null;

alter table public.client_notes add constraint client_notes_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.client_notes add constraint client_notes_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade;
alter table public.client_notes add constraint client_notes_author_tenant_fkey
  foreign key (author_id, tenant_id) references public.profiles (id, tenant_id);

create trigger client_notes_author_role before insert on public.client_notes
  for each row execute function private.enforce_role('author_id', 'admin');

create index client_notes_client_created_at_idx on public.client_notes (client_id, created_at desc);
create index client_notes_tenant_id_idx on public.client_notes (tenant_id);

-- A note, with an optional file. Empty base64 means no file. Bytes stay on the row, capped at 2 MB.
create function public.record_client_note(
  client_id uuid,
  body text,
  attachment_name text,
  attachment_type text,
  attachment_base64 text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  bytes bytea;
  stored_name text;
  new_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if body is null or char_length(btrim(body)) < 1 or char_length(body) > 2000 then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;

  select * into client from public.clients c where c.id = record_client_note.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA01';
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

  insert into public.client_notes (client_id, author_id, body, attachment_name, attachment_type, attachment_bytes)
  values (client.id, (select auth.uid()), btrim(body), stored_name, attachment_type, bytes)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.record_client_note(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_client_note(uuid, text, text, text, text) to authenticated;

grant select, insert, update, delete on public.client_notes to service_role;
grant select, insert (client_id, author_id, body, attachment_name, attachment_type, attachment_bytes) on public.client_notes to authenticated;

alter table public.client_notes enable row level security;
create policy "Admins read client notes" on public.client_notes for select to authenticated
  using ((select private.is_admin()));
create policy "Admins add client notes" on public.client_notes for insert to authenticated
  with check ((select private.is_admin()) and author_id = (select auth.uid()));
create policy "Own tenant only" on public.client_notes as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
