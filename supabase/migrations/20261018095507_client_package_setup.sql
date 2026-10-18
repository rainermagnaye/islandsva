-- The package agreed at conversion. Existing clients stay unset (all of these null together).
-- Slugs, hours and terms mirror content/packages.ts. Time zones mirror PACKAGE_TIMEZONES.
-- Money is US cents. Payments themselves stay M4; this only records what was confirmed.

alter table public.clients
  add column package_code text,
  add column hours_per_week smallint,
  add column term_months smallint,
  add column monthly_cents integer,
  add column currency text not null default 'USD',
  add column starts_on date,
  add column timezone text,
  add constraint clients_package_code_known check (
    package_code is null or package_code in ('essentials', 'executive', 'day-and-night')
  ),
  add constraint clients_package_hours check (
    package_code is null
    or (package_code = 'essentials' and hours_per_week = 20)
    or (package_code = 'executive' and hours_per_week = 40)
    or (package_code = 'day-and-night' and hours_per_week = 80)
  ),
  add constraint clients_term_months check (term_months is null or term_months in (1, 6, 12)),
  add constraint clients_monthly_cents check (monthly_cents is null or monthly_cents between 1 and 100000000),
  add constraint clients_currency_usd check (currency = 'USD'),
  add constraint clients_timezone_known check (
    timezone is null or timezone in (
      'America/Los_Angeles',
      'America/Denver',
      'America/Chicago',
      'America/New_York',
      'Europe/London',
      'Europe/Paris',
      'Asia/Dubai',
      'Asia/Singapore',
      'Asia/Manila',
      'Australia/Sydney',
      'Pacific/Auckland'
    )
  ),
  add constraint clients_package_complete check (
    (
      package_code is null
      and hours_per_week is null
      and term_months is null
      and monthly_cents is null
      and starts_on is null
      and timezone is null
    )
    or (
      package_code is not null
      and hours_per_week is not null
      and term_months is not null
      and monthly_cents is not null
      and starts_on is not null
      and timezone is not null
    )
  );

-- Conversion now also stores the confirmed package. The old argument list is replaced.
drop function public.convert_lead_noted(uuid, text, text, text, text);

create function public.convert_lead_noted(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_phone text,
  remarks text,
  package_code text,
  hours_per_week smallint,
  term_months smallint,
  monthly_cents integer,
  starts_on date,
  timezone text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  new_client uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if remarks is null or char_length(btrim(remarks)) < 1 or char_length(remarks) > 2000 then
    raise exception 'remarks are required' using errcode = 'check_violation';
  end if;
  if package_code is null or package_code not in ('essentials', 'executive', 'day-and-night') then
    raise exception 'choose a package' using errcode = 'check_violation';
  end if;
  if not (
    (package_code = 'essentials' and hours_per_week = 20)
    or (package_code = 'executive' and hours_per_week = 40)
    or (package_code = 'day-and-night' and hours_per_week = 80)
  ) then
    raise exception 'hours do not match the package' using errcode = 'check_violation';
  end if;
  if term_months is null or term_months not in (1, 6, 12) then
    raise exception 'choose a term' using errcode = 'check_violation';
  end if;
  if monthly_cents is null or monthly_cents <= 0 then
    raise exception 'monthly price is missing' using errcode = 'check_violation';
  end if;
  if starts_on is null then
    raise exception 'choose a start date' using errcode = 'check_violation';
  end if;
  if timezone is null or timezone not in (
    'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Manila',
    'Australia/Sydney', 'Pacific/Auckland'
  ) then
    raise exception 'choose a time zone' using errcode = 'check_violation';
  end if;

  select * into lead from public.leads l where l.id = convert_lead_noted.lead_id;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.disabled_at is not null then
    raise exception 'this lead is disabled' using errcode = 'IVA04';
  end if;

  new_client := public.convert_lead(convert_lead_noted.lead_id, convert_lead_noted.company_name, convert_lead_noted.contact_name, convert_lead_noted.contact_phone);

  update public.clients
  set
    package_code = convert_lead_noted.package_code,
    hours_per_week = convert_lead_noted.hours_per_week,
    term_months = convert_lead_noted.term_months,
    monthly_cents = convert_lead_noted.monthly_cents,
    starts_on = convert_lead_noted.starts_on,
    timezone = convert_lead_noted.timezone
  where id = new_client;

  insert into public.lead_events (lead_id, author_id, kind, body)
  values (convert_lead_noted.lead_id, (select auth.uid()), 'conversion', btrim(remarks));
  return new_client;
end;
$$;

revoke all on function public.convert_lead_noted(uuid, text, text, text, text, text, smallint, smallint, integer, date, text) from public, anon, authenticated, service_role;
grant execute on function public.convert_lead_noted(uuid, text, text, text, text, text, smallint, smallint, integer, date, text) to authenticated;

grant update (package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone) on public.clients to authenticated;
