-- Sprint-05 task-01: rate limiting counters (decision Z, core-api §4)
-- Atomic upsert from the door: INSERT ... ON CONFLICT DO UPDATE SET count = count + 1.
-- Purge uses the expires_at index (sprint-06, maintenance job).

create table public.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  expires_at timestamptz not null,
  primary key (key, window_start)
);

create index rate_limit_counters_expires_idx on public.rate_limit_counters (expires_at);

-- RLS: no policies for anon/authenticated (they see 0 rows); the server uses service_role,
-- which bypasses RLS. SELECT is granted so the failure is an empty result instead of
-- "permission denied" (the table is internal, but its existence is not a secret).
alter table public.rate_limit_counters enable row level security;

grant select on public.rate_limit_counters to anon, authenticated;
grant all on public.rate_limit_counters to service_role;

-- Server-internal table: RLS denies everything to anon and authenticated. Only service_role
-- (which bypasses RLS) reads and writes it. anon/authenticated keep SELECT but have no
-- policies, so they always get 0 rows.
