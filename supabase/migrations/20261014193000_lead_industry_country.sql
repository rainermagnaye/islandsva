-- Discovery-call answers. Nullable so enquiries already stored stay valid; the form requires both on new leads.
alter table public.leads
  add column industry text,
  add column country text,
  add constraint leads_industry_length check (industry is null or char_length(industry) between 1 and 80),
  add constraint leads_country_length check (country is null or char_length(country) between 1 and 80);
