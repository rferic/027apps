-- Sprint-06 task-04: machine tokens (service/delegated) and push devices.
-- The API writes through the service pool; RLS is the second barrier.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('service', 'delegated')),
  name text not null check (length(btrim(name)) between 1 and 80),
  scopes text[] not null check (cardinality(scopes) between 1 and 100),
  user_id uuid references public.profiles (id) on delete cascade,
  role_cap text check (role_cap in ('admin', 'super_admin')),
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  -- A service key has a cap and no user; a delegated key has a user and no cap.
  check ((kind = 'service') = (role_cap is not null)),
  check ((kind = 'delegated') = (user_id is not null)),
  check (expires_at is null or expires_at > created_at)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  push_token text unique check (push_token is null or length(push_token) between 8 and 4096),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
alter table public.devices enable row level security;

grant select, insert, update, delete on public.api_keys to authenticated;
grant select, insert, update, delete on public.devices to authenticated;

-- Delegated keys: the owner and admins read them; service keys: super_admin only.
create policy api_keys_select on public.api_keys
  for select to authenticated
  using (
    public.core_is_super_admin()
    or user_id = auth.uid()
    or (public.core_is_admin() and kind = 'delegated')
  );
create policy api_keys_write on public.api_keys
  for all to authenticated
  using (public.core_is_super_admin() or (user_id = auth.uid() and kind = 'delegated'))
  with check (public.core_is_super_admin() or (user_id = auth.uid() and kind = 'delegated'));

create policy devices_owner on public.devices
  for all to authenticated
  using (public.core_is_admin() or user_id = auth.uid())
  with check (public.core_is_admin() or user_id = auth.uid());

create index api_keys_user_idx on public.api_keys (user_id) where revoked_at is null;
create index api_keys_active_idx on public.api_keys (key_hash) where revoked_at is null;
create index devices_user_idx on public.devices (user_id) where revoked_at is null;
