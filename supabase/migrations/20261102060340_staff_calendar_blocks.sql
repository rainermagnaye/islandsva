-- Lead Gen and admin Book › Task is a to-do of their own, the same as a VA's untitled-client block.
-- calendar_blocks.va_id is still the owner (the column name stays); they may now be a closer or admin.
-- A block on a task stays VA-only (fill_calendar_block / IVA47).

drop trigger calendar_blocks_va_id_role on public.calendar_blocks;
create trigger calendar_blocks_va_id_role
  before insert on public.calendar_blocks
  for each row execute function private.enforce_role('va_id', 'va', 'closer', 'admin');

drop policy "Open VAs add their own blocks" on public.calendar_blocks;
create policy "The owner adds their own blocks" on public.calendar_blocks
  for insert to authenticated
  with check (
    va_id = (select auth.uid())
    and (
      ((select private.has_role('va')) and (select private.is_open_va()))
      or (select private.has_role('closer'))
      or (select private.is_admin())
    )
  );
