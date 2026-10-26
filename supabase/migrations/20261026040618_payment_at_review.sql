-- Sales summary (M7): an admin records the payment received when approving a registration packet. The packet
-- holds the client's proof of payment (a file); the amount, any bank or transfer fee, the date and a reference
-- go in payments, which the sales summary totals. One function does both steps in one transaction, so a packet is
-- never approved without its payment, nor a payment stored for a packet that wasn't approved.

alter table public.payments
  add column fee_cents integer not null default 0,
  add constraint payments_fee_within_amount check (fee_cents >= 0 and fee_cents <= amount_cents);

create index payments_tenant_paid_on_idx on public.payments (tenant_id, paid_on desc) where status = 'paid';

-- Secret key only. The actor must be an active admin of the client's tenant (the app has also checked the
-- session with two-factor). Then the payment is stored and accept_client_review moves the packet to approved;
-- its refusals (IVA06 unknown client, IVA08 not in review, IVA09 disabled or not pending) pass through.
-- IVA14 actor not allowed · IVA21 amount, fee or date not acceptable
create function public.accept_client_review_paid(client_id uuid, actor uuid, amount_cents integer, fee_cents integer, paid_on date, reference text)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  new_id uuid;
begin
  select * into client from public.clients c where c.id = accept_client_review_paid.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor and r.role in ('admin', 'super_admin') and p.status <> 'inactive' and p.tenant_id = client.tenant_id
  ) then
    raise exception 'only an admin of the client''s agency can approve a registration' using errcode = 'IVA14';
  end if;
  if amount_cents is null or amount_cents < 1 or amount_cents > 100000000
    or fee_cents is null or fee_cents < 0 or fee_cents > amount_cents
    or paid_on is null or paid_on > current_date then
    raise exception 'the amount, fee or date is not acceptable' using errcode = 'IVA21';
  end if;

  -- The review rules first, so nothing is stored for a packet that can't be approved.
  perform public.accept_client_review(client.id);

  insert into public.payments as pay (client_id, provider, status, amount_cents, fee_cents, term_months, provider_ref, paid_on, recorded_by)
  values (client.id, 'manual', 'paid', amount_cents, fee_cents, coalesce(client.term_months, 1), nullif(btrim(reference), ''), paid_on, actor)
  returning pay.id into new_id;
  return new_id;
end;
$$;

revoke all on function public.accept_client_review_paid(uuid, uuid, integer, integer, date, text) from public, anon, authenticated, service_role;
grant execute on function public.accept_client_review_paid(uuid, uuid, integer, integer, date, text) to service_role;
