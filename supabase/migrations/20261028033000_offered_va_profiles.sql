-- VA Match: a client reads a work profile of each VA offered to them, to decide whom to meet and add.
-- Work details only: skills, languages, education, certifications, past roles, responsibilities, achievements
-- and weekly working hours. Never personal ones (date of birth, gender, marital status, address, phone numbers,
-- emergency contact, references, résumé, avatar), which stay readable by the VA and admins alone.
--
-- Security definer, because a client has no read access to employee_profiles or va_working_hours (RLS) and
-- must not get it table-wide. The function itself limits the rows: the caller must hold `client`, and only VAs
-- on a shortlist of the caller's own company, in the caller's tenant, come back.

create function public.offered_va_profiles()
returns table (
  va_id uuid,
  first_name text,
  skills text,
  languages text,
  highest_education text,
  certifications text,
  employers jsonb,
  key_responsibilities text,
  achievements text,
  working_hours jsonb
)
language sql stable security definer set search_path = '' as $$
  select distinct on (s.va_id)
    s.va_id,
    s.va_first_name,
    ep.skills,
    ep.languages,
    ep.highest_education,
    ep.certifications,
    -- Position, company and dates only, whatever else an entry holds.
    coalesce((
      select jsonb_agg(jsonb_build_object('position', e ->> 'position', 'company', e ->> 'company', 'duration', e ->> 'duration'))
      from jsonb_array_elements(case when jsonb_typeof(ep.employers) = 'array' then ep.employers else '[]'::jsonb end) e
    ), '[]'::jsonb),
    ep.key_responsibilities,
    ep.achievements,
    coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'start', h.start_minute, 'end', h.end_minute) order by h.weekday)
      from public.va_working_hours h
      where h.va_id = s.va_id
    ), '[]'::jsonb)
  from public.va_shortlists s
  left join public.employee_profiles ep on ep.user_id = s.va_id
  where coalesce(current_setting('role', true), '') = 'authenticated'
    and (select private.has_role('client'))
    and s.client_id in (select private.own_client_ids())
    and s.tenant_id = (select private.tenant_id())
  order by s.va_id, s.created_at desc;
$$;

revoke all on function public.offered_va_profiles() from public, anon, authenticated, service_role;
grant execute on function public.offered_va_profiles() to authenticated;
