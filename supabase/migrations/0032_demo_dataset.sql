-- One row while the demo dataset exists, with the counts each module returned
-- from its `seed_fn`. It is what DELETE /api/v1/demo reports and what keeps a
-- second seed idempotent.
create table public.demo_dataset (
  id boolean primary key default true check (id),
  seeded_at timestamptz not null default now(),
  seed_results jsonb not null default '[]'::jsonb
);

alter table public.demo_dataset enable row level security;
-- Only the Core (service role) reads and writes the demo marker.
revoke all on public.demo_dataset from anon, authenticated;
grant all on public.demo_dataset to service_role;
