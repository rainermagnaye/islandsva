-- Tightens staff_profiles (20261013160000), which is already live, so this is a forward-only fix.
-- Every write the app makes goes through the server with the secret key (features/users/dal.ts), so
-- neither change affects the app; they close paths around it for anyone calling the API with their
-- own access token.

-- 1. Registration progress is derived by the server from which sections are filled. A signed-in user
--    (including an admin calling the API directly) may no longer set it on their own row.
revoke insert (registration_status, invitation_sent_at, registration_completed_at),
       update (registration_status, invitation_sent_at, registration_completed_at)
  on public.staff_profiles from authenticated;

-- 2. Only staff have a staff profile. "Own row" now also requires a staff role (VA, Closer or admin) in
--    the signed token, so a client account can't create or edit one for itself. Admins with two-factor
--    sign-in still manage anyone's.
drop policy "Insert own staff profile; admins insert any" on public.staff_profiles;
drop policy "Update own staff profile; admins update any" on public.staff_profiles;

create policy "Staff insert own staff profile; admins insert any" on public.staff_profiles
  for insert to authenticated
  with check (
    (user_id = (select auth.uid())
      and ((select private.has_role('va')) or (select private.has_role('closer')) or (select private.has_role('admin'))))
    or (select private.is_admin())
  );

create policy "Staff update own staff profile; admins update any" on public.staff_profiles
  for update to authenticated
  using (
    (user_id = (select auth.uid())
      and ((select private.has_role('va')) or (select private.has_role('closer')) or (select private.has_role('admin'))))
    or (select private.is_admin())
  )
  with check (
    (user_id = (select auth.uid())
      and ((select private.has_role('va')) or (select private.has_role('closer')) or (select private.has_role('admin'))))
    or (select private.is_admin())
  );
