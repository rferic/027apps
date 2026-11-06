-- Sprint-06 task-02: user categories and module grants.
-- English text is not involved here; RLS mirrors core-data-model §5.
-- FKs to module_registry/api_keys are added when those tables exist (tasks 04/05).

create table public.user_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references public.profiles (id),
  created_by_key uuid,
  created_at timestamptz not null default now(),
  check (num_nonnulls(created_by, created_by_key) = 1)
);

create table public.user_category_members (
  user_category_id uuid not null references public.user_categories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_category_id, user_id)
);

-- The real grant: access travels with the user, not with the category.
create table public.user_modules (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  granted_by uuid references public.profiles (id),
  granted_by_key uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, module_key),
  check (num_nonnulls(granted_by, granted_by_key) = 1)
);

-- Bulk-assignment template: assigning materialises user_modules for current members.
create table public.user_category_modules (
  user_category_id uuid not null references public.user_categories (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  assigned_by uuid references public.profiles (id),
  assigned_by_key uuid,
  created_at timestamptz not null default now(),
  primary key (user_category_id, module_key),
  check (num_nonnulls(assigned_by, assigned_by_key) = 1)
);

alter table public.user_categories enable row level security;
alter table public.user_category_members enable row level security;
alter table public.user_modules enable row level security;
alter table public.user_category_modules enable row level security;

grant select, insert, update, delete on public.user_categories to authenticated;
grant select, insert, update, delete on public.user_category_members to authenticated;
grant select, insert, update, delete on public.user_modules to authenticated;
grant select, insert, update, delete on public.user_category_modules to authenticated;

-- Categories: admins manage; a member may read their own category label.
create policy user_categories_select on public.user_categories
  for select to authenticated
  using (
    public.core_is_admin()
    or exists (
      select 1 from public.user_category_members m
      where m.user_category_id = id and m.user_id = auth.uid()
    )
  );
create policy user_categories_write on public.user_categories
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

create policy user_category_members_select on public.user_category_members
  for select to authenticated
  using (public.core_is_admin() or user_id = auth.uid());
create policy user_category_members_write on public.user_category_members
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

-- Grants are read by the owner and admins; only admins write them.
create policy user_modules_select on public.user_modules
  for select to authenticated
  using (public.core_is_admin() or user_id = auth.uid());
create policy user_modules_write on public.user_modules
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

create policy user_category_modules_select on public.user_category_modules
  for select to authenticated
  using (public.core_is_admin());
create policy user_category_modules_write on public.user_category_modules
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

create index user_category_members_user_idx on public.user_category_members (user_id);
create index user_modules_module_idx on public.user_modules (module_key);
create index user_category_modules_module_idx on public.user_category_modules (module_key);
