-- A new label only: a task waits in review after the VA hands it over, until the client approves it.
-- Postgres will not let a statement use a value added in the same transaction, so the review flow
-- itself lives in the following migration (as with manual_meeting_kind).

alter type public.task_status add value if not exists 'review' before 'done';
