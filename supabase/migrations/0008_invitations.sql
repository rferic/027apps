-- Sprint-06 task-03: invitations (single-use join links).
-- The redeem flow runs with the service role; RLS only exposes the panel side.
-- FKs to module_registry/api_keys arrive with those tables (tasks 04/05).

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  name text not null check (length(btrim(name)) between 1 and 80),
  user_category_id uuid references public.user_categories (id) on delete set null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id),
  created_by_key uuid,
  created_at timestamptz not null default now(),
  check (num_nonnulls(created_by, created_by_key) = 1),
  check (expires_at > created_at)
);

create table public.invitation_modules (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  primary key (invitation_id, module_key)
);

alter table public.invitations enable row level security;
alter table public.invitation_modules enable row level security;

grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.invitation_modules to authenticated;

create policy invitations_admin on public.invitations
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

create policy invitation_modules_admin on public.invitation_modules
  for all to authenticated
  using (public.core_is_admin())
  with check (public.core_is_admin());

create index invitations_email_idx on public.invitations (email);
create index invitations_pending_idx on public.invitations (expires_at)
  where used_at is null and revoked_at is null;
