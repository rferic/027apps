-- Sprint-05 task-01: perfiles del Core y helpers de rol
-- ADRs: 0004 (bordes y capa de aplicación), 0008 (fechas)

-- Perfil de usuario del Core. La identidad (email/contraseña) la gestiona Supabase Auth;
-- aquí solo viven los datos que la API expone y el rol que gobierna los scopes.
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

-- El rol solo se cambia desde la capa de aplicación (guard de scopes); a nivel SQL
-- se protege con un grant por columnas: authenticated solo puede UPDATE
-- display_name/locale/timezone (ver migración de RLS). Con DELETE denegado.
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

-- Sin grants para anon ni public: solo authenticated y service_role pueden preguntar.
revoke execute on function public.core_is_super_admin() from public, anon;
revoke execute on function public.core_is_admin() from public, anon;
grant execute on function public.core_is_super_admin() to authenticated, service_role;
grant execute on function public.core_is_admin() to authenticated, service_role;

-- RLS
alter table public.profiles enable row level security;

-- anon/authenticated pueden intentar leer (RLS filtra), así la superficie no filtra
-- por error distinto al de un recurso vacío; service_role tiene todo (API backend).
grant select on public.profiles to anon, authenticated;
-- El rol y la desactivación solo se cambian desde la capa de aplicación (service_role);
-- authenticated solo puede editar sus propias preferencias (column grant).
grant update (display_name, locale, timezone) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or core_is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (core_is_admin()) with check (core_is_admin());
