-- Sprint-05 task-01: Core profiles and role helpers
-- ADRs: 0004 (borders and application layer), 0008 (dates)

-- Core user profile. Identity (email/password) is managed by Supabase Auth;
-- only the data exposed by the API and the role that governs scopes live here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  role text not null default 'user'
    check (role in ('super_admin', 'admin', 'user')),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The role is only changed from the application layer (scope guard); at the SQL
-- level it is protected with a column grant: authenticated can only UPDATE
-- display_name/locale/timezone (see the RLS migration). DELETE is denied.
create function public.core_is_super_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and deactivated_at is null
  );
$$;

create function public.core_is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin') and deactivated_at is null
  );
$$;

-- No grants for anon or public: only authenticated and service_role can ask.
revoke execute on function public.core_is_super_admin() from public, anon;
revoke execute on function public.core_is_admin() from public, anon;
grant execute on function public.core_is_super_admin() to authenticated, service_role;
grant execute on function public.core_is_admin() to authenticated, service_role;

-- RLS
alter table public.profiles enable row level security;

-- anon/authenticated may attempt reads (RLS filters), so the surface does not leak
-- through an error different from an empty resource; service_role has full access (API backend).
grant select on public.profiles to anon, authenticated;
-- Role and deactivation are only changed from the application layer (service_role);
-- authenticated can only edit its own preferences (column grant).
grant update (display_name, locale, timezone) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or core_is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (core_is_admin()) with check (core_is_admin());
