-- Runtime facts copied from the manifest so transitions do not have to read
-- every package from disk: whether the module shows up in the app, and which
-- modules it requires.
alter table public.module_registry
  add column app_visible boolean not null default true,
  add column requires jsonb not null default '[]'::jsonb;

comment on column public.module_registry.app_visible is
  'Manifest app.visible: false means background module (no launcher entry).';
comment on column public.module_registry.requires is
  'Manifest requires: [{ key, version }]; version is a minimum.';
