-- The author of a comment may change its text or remove it. Anyone else still cannot.

grant update (body) on public.task_comments to authenticated;

create policy "The author edits their comment" on public.task_comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "The author deletes their comment" on public.task_comments for delete to authenticated
  using (author_id = (select auth.uid()));
