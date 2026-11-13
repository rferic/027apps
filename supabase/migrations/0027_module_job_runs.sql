-- One row per scheduled execution. The unique key is the claim: two dispatcher
-- calls in the same minute insert the same tuple and only one wins.
create table public.module_job_runs (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.module_registry (key) on delete cascade,
  job_key text not null,
  scheduled_for timestamptz not null,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error text,
  unique (module_key, job_key, scheduled_for)
);

create index module_job_runs_recent on public.module_job_runs (module_key, started_at desc);

alter table public.module_job_runs enable row level security;
-- The dispatcher is the only writer and it connects as `service_role`; Supabase
-- would otherwise leave `anon` and `authenticated` with the default grants.
revoke all on public.module_job_runs from anon, authenticated;
grant all on public.module_job_runs to service_role;
