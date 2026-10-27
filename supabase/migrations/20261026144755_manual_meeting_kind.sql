-- New labels only. Postgres will not let the next statement use a value added in the same transaction,
-- so the columns and functions live in the following migration.

alter type public.meeting_kind add value if not exists 'manual';
alter type public.meeting_event_kind add value if not exists 'updated';
alter type public.meeting_event_kind add value if not exists 'cancelled';
