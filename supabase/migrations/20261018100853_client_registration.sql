-- Business details copied from the lead, then completed on the client profile.
-- registration_email_sent_at is set only after that email is accepted by the mail provider.

alter table public.clients
  add column business jsonb not null default '{}'::jsonb,
  add column registration_email_sent_at timestamptz,
  add constraint clients_business_object check (jsonb_typeof(business) = 'object' and octet_length(business::text) <= 4000);

grant update (business, registration_email_sent_at) on public.clients to authenticated;
