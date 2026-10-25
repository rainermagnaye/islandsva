-- A client invited through the registration packet becomes active when their login first signs in. Until now
-- record_client_invite linked the login and set onboarding_status = 'invite_sent', but nothing ever moved the
-- client from pending to active, so the portal (and book_demo, which needs an active client) treated them as
-- not yet onboarded. Only that path is touched: a pending, enabled client whose invite went out.

create function private.activate_client_on_sign_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.clients c
  set status = 'active', activated_at = now()
  where c.user_id = new.id
    and c.status = 'pending'
    and c.onboarding_status = 'invite_sent'
    and c.disabled_at is null;
  return new;
end;
$$;

revoke all on function private.activate_client_on_sign_in() from public, anon, authenticated, service_role;

-- profiles.signed_in_at is set once, by the auth user trigger, on the first sign-in.
create trigger profiles_activate_client after update of signed_in_at on public.profiles
  for each row when (old.signed_in_at is null and new.signed_in_at is not null)
  execute function private.activate_client_on_sign_in();
