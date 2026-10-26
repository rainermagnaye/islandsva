-- Removes what the registration packet (client_packets, #54) replaced: the emailed onboarding link from
-- client_onboarding (M3-a) and the manual payment and activation functions from client_activation (M3-b).
-- Nothing in the app calls them any more.
--
-- Kept on purpose:
--   * payments: the sales summary reads it, and accept_client_review_paid writes it.
--   * the clients columns from M3-a (billing, consented_at, onboarding_submitted_at): dropping columns loses data
--     and gains nothing yet.
--   * the 'client_onboarding_links' case in private.assign_tenant: a case for a table that no longer exists is
--     inert, and redefining that function risks dropping another case (see restore_assign_tenant_cases).
--
-- Data: dropping client_onboarding_links deletes its rows (one old link on the live database when written).

drop function public.activate_client(uuid, uuid, uuid);
drop function public.void_payment(uuid, uuid);
drop function public.record_manual_payment(uuid, uuid, integer, text, date);
drop function public.submit_onboarding(text, text, text, jsonb, jsonb, boolean);
drop function public.revoke_onboarding_link(uuid, uuid);
drop function public.issue_onboarding_link(uuid, uuid, text);

drop table public.client_onboarding_links;
