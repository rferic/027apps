-- 0036 — one-shot phone migration codes.
--
-- The QR carries a bearer token (`027_mig_` + 32 random bytes). Only its
-- SHA-256 is stored, it lives 60 seconds and it is single-use. No email,
-- refresh token, password or push token is kept here: the exchange mints a
-- Supabase magic link and the new phone verifies it.
--
-- The table is service-internal: it has no grants to anon/authenticated, like
-- `rate_limit_counters`, so PostgREST never exposes it.

create table public.device_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.device_transfers enable row level security;

revoke all on public.device_transfers from anon, authenticated;

-- The server connects as service_role: the grant has to be explicit, because
-- default privileges of a table created by the migration runner are not
-- guaranteed in every environment (CI runs `supabase db reset`).
grant select, insert, update, delete on public.device_transfers to service_role;

create index device_transfers_user_recent_idx
  on public.device_transfers (user_id, created_at desc);

comment on table public.device_transfers is
  'Single-use phone migration codes: only the token hash, 60-second TTL.';
