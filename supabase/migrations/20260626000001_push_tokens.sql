create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  token       text not null,
  platform    text not null default 'ios' check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "Users can manage own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id);

create index idx_push_tokens_user_id on public.push_tokens(user_id);
create index idx_push_tokens_group_id on public.push_tokens(group_id);
