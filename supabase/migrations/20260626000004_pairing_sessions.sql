create table if not exists public.pairing_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  secret      text not null,
  expires_at  timestamptz not null default now() + interval '5 minutes',
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.pairing_sessions enable row level security;

create policy "Users can read own pairing sessions"
  on public.pairing_sessions
  for select
  using (auth.uid() = user_id);

create index idx_pairing_sessions_user_id on public.pairing_sessions(user_id);
create index idx_pairing_sessions_expires_at on public.pairing_sessions(expires_at);

-- Cleanup expired sessions (runs on insert)
create or replace function public.cleanup_expired_pairing_sessions()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from public.pairing_sessions where expires_at < now();
  return new;
end;
$$;

create trigger cleanup_expired_pairing_sessions
  after insert on public.pairing_sessions
  for each row
  execute function public.cleanup_expired_pairing_sessions();
