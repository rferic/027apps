-- Quick actions a module contributes to the app's add button. Copied from the
-- manifest so `/me/modules` never reads a package on the request path.
alter table public.module_registry
  add column app_actions jsonb not null default '[]'::jsonb;

comment on column public.module_registry.app_actions is
  'Manifest app_actions: [{ key, label, icon, screen }].';
