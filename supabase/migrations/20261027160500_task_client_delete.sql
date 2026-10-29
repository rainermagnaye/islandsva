-- The client who owns a task may delete it. Files on that task go with it.
-- Anyone else, including the database owner, still cannot delete a file (IVA36).

create or replace function private.guard_task_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task public.tasks%rowtype;
  client public.clients%rowtype;
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('role', true), '') <> 'authenticated' then
      raise exception 'this attachment cannot change' using errcode = 'IVA36';
    end if;
    select * into task from public.tasks t where t.id = old.task_id;
    if not found then
      return old;
    end if;
    select * into client from public.clients c where c.id = task.client_id;
    if (select auth.uid()) is distinct from client.user_id and (select auth.uid()) is distinct from task.created_by then
      raise exception 'this attachment cannot change' using errcode = 'IVA36';
    end if;
    return old;
  end if;

  if tg_op <> 'INSERT' then
    raise exception 'this attachment cannot change' using errcode = 'IVA36';
  end if;

  new.name := btrim(new.name);
  select * into task from public.tasks t where t.id = new.task_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;
  select * into client from public.clients c where c.id = task.client_id;
  if not found or client.status <> 'active' or client.disabled_at is not null then
    raise exception 'the company is not active' using errcode = 'IVA23';
  end if;
  if coalesce(current_setting('role', true), '') = 'authenticated'
    and (select auth.uid()) is distinct from client.user_id
    and (select auth.uid()) is distinct from task.created_by
  then
    raise exception 'this attachment cannot change' using errcode = 'IVA36';
  end if;
  return new;
end;
$$;

grant delete on public.tasks, public.task_comments, public.task_attachments to authenticated;

create policy "The client deletes their task" on public.tasks for delete to authenticated
  using (
    (select private.has_role('client'))
    and client_id in (select private.own_client_ids())
  );

create policy "The client deletes comments on their task" on public.task_comments for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (select private.has_role('client'))
        and t.client_id in (select private.own_client_ids())
    )
  );

create policy "The client deletes files on their task" on public.task_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (select private.has_role('client'))
        and t.client_id in (select private.own_client_ids())
    )
  );
