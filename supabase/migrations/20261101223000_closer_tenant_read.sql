-- Lead Gens read every lead, client, meeting, timeline row and assignment in their agency.
-- Restrictive Own tenant only still isolates tenants. Writes stay owner-scoped: a Closer still
-- creates and edits only clients they created, and still cannot update another person's lead.

drop policy "Read leads by role" on public.leads;
create policy "Read leads by role" on public.leads for select to authenticated
  using ((select private.is_admin()) or (select private.has_role('closer')));

drop policy "Read clients by role" on public.clients;
create policy "Read clients by role" on public.clients for select to authenticated
  using (
    (select private.is_admin())
    or (select private.has_role('closer'))
    or ((select private.has_role('client')) and user_id = (select auth.uid()))
    or ((select private.has_role('va')) and id in (select private.assigned_client_ids()))
  );

drop policy "Read meetings by role" on public.meetings;
create policy "Read meetings by role" on public.meetings for select to authenticated
  using (
    (select private.is_admin())
    or (select private.has_role('closer'))
    or staff_id = (select auth.uid())
    or (select auth.uid()) = any(staff_ids)
    or client_id in (select c.id from public.clients c where c.user_id = (select auth.uid()))
    or exists (
      select 1 from public.clients c
      where c.user_id = (select auth.uid()) and c.id = any(client_ids)
    )
  );

drop policy "Admins read lead events" on public.lead_events;
create policy "Admins read lead events" on public.lead_events for select to authenticated
  using ((select private.is_admin()) or (select private.has_role('closer')));

drop policy "Read assignments by role" on public.client_va_assignments;
create policy "Read assignments by role" on public.client_va_assignments for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
    or (select private.has_role('closer'))
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
  );
