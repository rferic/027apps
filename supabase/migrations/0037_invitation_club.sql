-- 0037 — club invitations: levels, live quota, QR codes and grants.
-- Additive: the admin invitation flow keeps working with email/name.

alter table public.profiles
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column invite_level integer check (invite_level between 1 and 100);

update public.profiles
   set invite_level = 1
 where role = 'user' and invite_level is null;

alter table public.invitations
  alter column email drop not null,
  alter column name drop not null,
  alter column expires_in_days drop not null,
  -- Only admin invitations remember a duration (they are the renewable ones);
  -- without this an anonymous row would be filled with the old 7-day default.
  alter column expires_in_days drop default,
  add column depth integer check (depth between 1 and 100),
  add column source text not null default 'admin'
    check (source in ('admin', 'member', 'qr')),
  add column redeemed_by uuid references public.profiles (id) on delete set null;

update public.invitations set depth = 1, source = 'admin' where depth is null;

alter table public.module_registry
  add column delegable boolean not null default false;

create table public.invitation_categories (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_category_id uuid not null references public.user_categories (id) on delete cascade,
  primary key (invitation_id, user_category_id)
);

create table public.join_codes (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  invitation_id uuid references public.invitations (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.invitation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 20),
  reason text check (reason is null or length(btrim(reason)) between 1 and 280),
  state text not null default 'pending'
    check (state in ('pending', 'approved', 'rejected', 'cancelled')),
  granted_amount integer check (granted_amount between 1 and 100),
  resolution_reason text
    check (resolution_reason is null or length(btrim(resolution_reason)) between 1 and 280),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state = 'pending') = (resolved_at is null))
);

create unique index invitation_requests_one_pending
  on public.invitation_requests (requester_id) where state = 'pending';

create table public.invitation_quota_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 100),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_by_key uuid,
  request_id uuid references public.invitation_requests (id) on delete set null,
  reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(granted_by, granted_by_key) <= 1)
);

create index profiles_invited_by_idx on public.profiles (invited_by)
  where invited_by is not null;

create index invitations_inviter_pending_idx
  on public.invitations (created_by, expires_at)
  where used_at is null and revoked_at is null;

create index join_codes_inviter_recent_idx
  on public.join_codes (inviter_id, created_at desc);

alter table public.invitation_categories enable row level security;
alter table public.join_codes enable row level security;
alter table public.invitation_requests enable row level security;
alter table public.invitation_quota_grants enable row level security;

-- Server-only tables: no grants to anon/authenticated, same as device_transfers.
revoke all on public.invitation_categories from anon, authenticated;
revoke all on public.join_codes from anon, authenticated;
revoke all on public.invitation_requests from anon, authenticated;
revoke all on public.invitation_quota_grants from anon, authenticated;

-- The server connects as service_role for these tables: the grant has to be
-- explicit, because default privileges are not guaranteed in every environment
-- (CI runs `supabase db reset`). Mirrors 0036_device_transfers.sql.
grant select, insert, update, delete on public.invitation_categories to service_role;
grant select, insert, update, delete on public.join_codes to service_role;
grant select, insert, update, delete on public.invitation_requests to service_role;
grant select, insert, update, delete on public.invitation_quota_grants to service_role;

insert into public.settings_categories (category_key, label, help, icon, sort_order)
values ('invitations', 'Invitations',
        'Who can join and how many people each member may bring.', 'users', 60)
on conflict (category_key) do nothing;

insert into public.settings
  (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
values
  ('invitations', 'invitations.levels', 'Invitation levels',
   'How many people each level may invite. Level 1 is invited by an administrator; level 2 by a level-1 member, and so on.',
   '[{"level":1,"quota":5},{"level":2,"quota":2},{"level":3,"quota":1}]'::jsonb,
   false, false, 'none', 10)
on conflict (category_key, key) do nothing;
