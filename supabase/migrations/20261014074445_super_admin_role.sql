-- Super Admin: global control across every tenant (see the tenants migration that follows).
-- On its own because Postgres can't use a new enum value in the transaction that adds it; the next
-- migration's helpers and policies refer to it.
alter type public.app_role add value if not exists 'super_admin';
