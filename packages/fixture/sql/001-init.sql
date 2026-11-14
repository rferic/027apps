create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy notes_own on notes
  for all
  using (user_id = public.core_current_user_id())
  with check (user_id = public.core_current_user_id());
