-- Demo hooks declared by each module: the Core seeds and clears sample data
-- through these functions instead of pretending a module is a demo package.
alter table public.module_registry
  add column demo jsonb;

comment on column public.module_registry.demo is
  'Manifest demo: { seed_fn, clear_fn } or null.';
