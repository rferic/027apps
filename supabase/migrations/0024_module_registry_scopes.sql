-- Scopes each installed module declares, so the API door can resolve a module
-- request without reading the package manifest on every call. Kept in sync by
-- the installer from the manifest; the table is the runtime source of truth.
alter table public.module_registry
  add column scopes text[] not null default '{}';

comment on column public.module_registry.scopes is
  'Manifest scopes; the door checks the caller has a grant for this module and that the requested scope is declared here.';
