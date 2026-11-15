-- Dashboard widgets declared by each module: the endpoint reads them from the
-- registry and calls their `data_fn`, so a request never touches a package.
alter table public.module_registry
  add column dashboard_widgets jsonb not null default '[]'::jsonb;

comment on column public.module_registry.dashboard_widgets is
  'Manifest dashboard_widgets: [{ key, type, surface, title, icon, order, data_fn }].';
