-- Payment verification (slice 1b, expand only). An admin approves a registration packet and records the payment
-- through a new function, approve_client_payment, which adds to accept_client_review_paid's rules:
--   · a bank reference is required (IVA42) and is unique among paid payments in the agency (IVA41), compared with
--     whitespace removed and case ignored (hyphens count) — enforced by a partial unique index as well;
--   · the packet must carry an acceptance of the client's current terms, or be one signed with the earlier sample
--     consent (legacy_consent) (IVA43);
--   · the audit log shows the admin, not System.
-- accept_client_review_paid and submit_client_packet stay as they are: the current app calls them against the same
-- database. They are dropped in a later contract migration, once the app calls approve_client_payment. Until then the
-- old function also meets the new index, and a duplicate reference fails there with 23505.

-- Backfill (the tests re-run the statements between these two markers on fixture rows) --------------------------
-- Again, as in 20261029172015_registration_agreement: the old app may have submitted packets since then.
-- Only packets without an acceptance: one signed through the new steps is checked against its terms instead.
update public.client_packets p
set legacy_consent = true
from public.clients c
where c.id = p.client_id
  and c.onboarding_status in ('pending_review', 'approved', 'invite_sent')
  and p.consent_signed_at is not null
  and p.agreement_id is null
  and not p.legacy_consent;

update public.clients c
set onboarding_submitted_at = p.submitted_at
from public.client_packets p
where p.client_id = c.id
  and c.onboarding_status = 'pending_review'
  and c.onboarding_submitted_at is null
  and p.submitted_at is not null;
-- End of backfill -------------------------------------------------------------------------------------------------

-- Duplicate reference guard (the tests re-run the block between these two markers) -------------------------------
-- Stops the migration, rather than failing on the index below, with a message saying what to fix first.
-- docs/operations.md has the query that lists them. The share lock keeps new payments out until the index exists.
lock table public.payments in share mode;
do $guard$
declare
  duplicates integer;
begin
  select count(*) into duplicates
  from (
    select 1
    from public.payments pay
    where pay.status = 'paid' and pay.provider_ref is not null
    group by pay.tenant_id, lower(regexp_replace(pay.provider_ref, '\s+', '', 'g'))
    having count(*) > 1
  ) dup;
  if duplicates > 0 then
    raise exception 'payments: % paid reference(s) are used more than once in an agency; fix them before this migration', duplicates
      using errcode = 'unique_violation';
  end if;
end;
$guard$;
-- End of duplicate reference guard ---------------------------------------------------------------------------------

create unique index payments_paid_reference_key
  on public.payments (tenant_id, lower(regexp_replace(provider_ref, '\s+', '', 'g')))
  where status = 'paid' and provider_ref is not null;

-- Secret key only. Same arguments and result (the payment's id) as accept_client_review_paid, so the app can swap the
-- call. The actor must be an active admin (or Super Admin) of the client's agency, as there: payments.recorded_by
-- must belong to the payment's tenant. The client is locked, then its packet (the order the packet steps use).
-- IVA06 unknown client or packet · IVA14 actor not allowed · IVA21 amount, fee or date · IVA42 no reference ·
-- IVA09 client disabled or not pending · IVA08 not in review · IVA43 no acceptance of the current terms ·
-- IVA41 reference already used by a paid payment in this agency
create function public.approve_client_payment(
  client_id uuid,
  actor uuid,
  amount_cents integer,
  fee_cents integer,
  paid_on date,
  reference text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  packet public.client_packets%rowtype;
  ref text := nullif(btrim(coalesce(approve_client_payment.reference, '')), '');
  new_id uuid;
  violated text;
begin
  select * into client from public.clients c where c.id = approve_client_payment.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = approve_client_payment.actor and r.role in ('admin', 'super_admin')
      and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only an admin of the client''s agency can approve a registration' using errcode = 'IVA14';
  end if;
  -- After the actor check, and transaction-local: the audit log names this admin for the writes below.
  perform set_config('app.actor', approve_client_payment.actor::text, true);

  if approve_client_payment.amount_cents is null or approve_client_payment.amount_cents < 1
    or approve_client_payment.amount_cents > 100000000
    or approve_client_payment.fee_cents is null or approve_client_payment.fee_cents < 0
    or approve_client_payment.fee_cents > approve_client_payment.amount_cents
    or approve_client_payment.paid_on is null or approve_client_payment.paid_on > current_date
  then
    raise exception 'the amount, fee or date is not acceptable' using errcode = 'IVA21';
  end if;
  if ref is null then
    raise exception 'the bank reference is required' using errcode = 'IVA42';
  end if;

  select * into packet from public.client_packets p where p.client_id = client.id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null or client.status <> 'pending' then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status <> 'pending_review' then
    raise exception 'registration is not in review' using errcode = 'IVA08';
  end if;
  -- A Closer can still edit the company or package during review, so the acceptance is checked against now. The
  -- legacy consent counts only while the packet has no acceptance: once accepted, the acceptance is what is checked.
  if not (packet.legacy_consent and packet.agreement_id is null) and not exists (
    select 1 from public.client_agreements a
    where a.id = packet.agreement_id and a.client_id = client.id and a.terms = private.client_agreement_terms(client)
  ) then
    raise exception 'the agreement was not accepted for the current terms' using errcode = 'IVA43';
  end if;
  if exists (
    select 1 from public.payments pay
    where pay.tenant_id = client.tenant_id and pay.status = 'paid' and pay.provider_ref is not null
      and lower(regexp_replace(pay.provider_ref, '\s+', '', 'g')) = lower(regexp_replace(ref, '\s+', '', 'g'))
  ) then
    raise exception 'this bank reference is already recorded' using errcode = 'IVA41';
  end if;

  update public.client_packets p set
    review_issues = '{}',
    review_note = null,
    updated_at = now()
  where p.client_id = client.id;
  update public.clients c set onboarding_status = 'approved' where c.id = client.id;

  begin
    insert into public.payments as pay
      (client_id, provider, status, amount_cents, fee_cents, term_months, provider_ref, paid_on, recorded_by)
    values (
      client.id, 'manual', 'paid', approve_client_payment.amount_cents, approve_client_payment.fee_cents,
      coalesce(client.term_months, 1), ref, approve_client_payment.paid_on, approve_client_payment.actor
    )
    returning pay.id into new_id;
  exception when unique_violation then
    -- Reached only by a concurrent insert (two approvals with one reference at once); the pre-check above covers a
    -- single connection, so this path is tested by reasoning (PGlite has one connection). The loser gets IVA41 too.
    get stacked diagnostics violated = constraint_name;
    if violated = 'payments_paid_reference_key' then
      raise exception 'this bank reference is already recorded' using errcode = 'IVA41';
    end if;
    raise;
  end;
  return new_id;
end;
$$;

revoke all on function public.approve_client_payment(uuid, uuid, integer, integer, date, text)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_client_payment(uuid, uuid, integer, integer, date, text) to service_role;
