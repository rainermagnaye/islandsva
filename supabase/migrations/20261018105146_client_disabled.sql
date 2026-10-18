-- A disabled client stays in the database and leaves the client list until an admin enables them.
alter table public.clients add column disabled_at timestamptz;

grant update (disabled_at) on public.clients to authenticated;
