create table if not exists public.notification_prefs (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  global_enabled boolean not null default true,
  prefs         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy "Users can manage own notification prefs"
  on public.notification_prefs
  for all
  using (auth.uid() = user_id);

-- Auto-create prefs row on signup
create or replace function public.handle_new_user_notification_prefs()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notification_prefs (user_id, global_enabled, prefs)
  values (new.id, true, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notification_prefs on auth.users;
create trigger on_auth_user_created_notification_prefs
  after insert on auth.users
  for each row
  execute function public.handle_new_user_notification_prefs();
