-- The admin leads list (features/leads/dal.ts listLeads) shows every lead newest first, one page at a
-- time. leads_status_created_at_idx serves it only when filtered by status; without a status filter
-- Postgres would read and sort the whole table for each page. Index-only change: no data, grants or
-- policies are touched. A plain (not CONCURRENTLY) build so the migration can run in one transaction —
-- it briefly blocks writes to leads, which is fine at the table's size.
create index leads_created_at_idx on public.leads (created_at desc);
