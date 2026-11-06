-- Sprint-06 task-05: module registry and installer support.
-- The installer runs DDL as `module_installer`, a non-superuser role scoped to
-- each module's own schema; the API applies it inside one transaction.

create table public.module_registry (
  key text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  state text not null check (state in ('installed', 'active', 'disabled')),
  is_public boolean not null default false,
  mcp_exposed text not null default 'read' check (mcp_exposed in ('none', 'read', 'read_write')),
  manifest_digest text not null check (manifest_digest ~ '^sha256:[0-9a-f]{64}$'),
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.module_migrations (
  module_key text not null references public.module_registry (key) on delete cascade,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  direction text not null check (direction in ('up', 'down')),
  ddl_digest text not null check (ddl_digest ~ '^sha256:[0-9a-f]{64}$'),
  applied_at timestamptz not null default now(),
  primary key (module_key, version, direction)
);

-- Catalog read for authenticated users; writes only through the installer.
alter table public.module_registry enable row level security;
alter table public.module_migrations enable row level security;

grant select on public.module_registry to authenticated;
grant select on public.module_migrations to authenticated;
grant all on public.module_registry to service_role;
grant all on public.module_migrations to service_role;

create policy module_registry_select on public.module_registry
  for select to authenticated using (true);
create policy module_migrations_select on public.module_migrations
  for select to authenticated using (public.core_is_super_admin());

-- Restricted role for module DDL: no superuser, no Core schema privileges.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'module_installer') then
    create role module_installer nologin;
  end if;
end
$$;

-- The migration runner connects as `postgres`; it must be able to SET ROLE.
grant module_installer to postgres;

-- Deferred FKs: module grants now reference the registry (uninstall cascades).
alter table public.user_modules
  add constraint user_modules_module_key_fkey
  foreign key (module_key) references public.module_registry (key) on delete cascade;
alter table public.user_category_modules
  add constraint user_category_modules_module_key_fkey
  foreign key (module_key) references public.module_registry (key) on delete cascade;
alter table public.invitation_modules
  add constraint invitation_modules_module_key_fkey
  foreign key (module_key) references public.module_registry (key) on delete cascade;

-- Deferred FKs: machine actors now reference api_keys (task-04).
alter table public.user_categories
  add constraint user_categories_created_by_key_fkey
  foreign key (created_by_key) references public.api_keys (id);
alter table public.user_category_modules
  add constraint user_category_modules_assigned_by_key_fkey
  foreign key (assigned_by_key) references public.api_keys (id);
alter table public.user_modules
  add constraint user_modules_granted_by_key_fkey
  foreign key (granted_by_key) references public.api_keys (id);
alter table public.invitations
  add constraint invitations_created_by_key_fkey
  foreign key (created_by_key) references public.api_keys (id);
alter table public.settings
  add constraint settings_updated_by_key_fkey
  foreign key (updated_by_key) references public.api_keys (id);

-- Module translations are attributed per module: source = 'module:<key>'.
alter table public.translations drop constraint if exists translations_source_check;
alter table public.translations add constraint translations_source_check
  check (source = 'code' or source = 'module' or source like 'module:%' or source in ('import', 'manual'));

create index module_registry_state_idx on public.module_registry (state);
