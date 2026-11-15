-- Jobs declared by each module, so the dispatcher reads the registry instead of
-- every package on each tick.
alter table public.module_registry
  add column jobs jsonb not null default '[]'::jsonb;

comment on column public.module_registry.jobs is
  'Manifest jobs: [{ key, schedule, fn, timeout_seconds }].';
