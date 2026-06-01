create table if not exists todo_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  title        text not null,
  completed    boolean not null default false,
  visibility   text not null default 'private' check (visibility in ('private', 'public')),
  assigned_to  uuid references auth.users on delete set null,
  group_id     uuid not null references public.groups(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table todo_items enable row level security;

-- SELECT:
--   private: solo user_id (creador)
--   public: cualquier miembro del grupo
create policy "Users can read own todos"
  on todo_items for select
  using (
    auth.uid() = user_id
    or (
      visibility = 'public'
      and exists (
        select 1 from public.group_members gm
        where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id
      )
    )
  );

create policy "Users can insert own todos"
  on todo_items for insert
  with check (auth.uid() = user_id);

-- UPDATE: solo el creador, o cualquier miembro del grupo si es public y no tiene assigned_to o está asignado
create policy "Users can update own todos"
  on todo_items for update
  using (
    auth.uid() = user_id
    or (
      visibility = 'public'
      and exists (
        select 1 from public.group_members gm
        where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id
      )
      and (assigned_to is null or assigned_to = auth.uid())
    )
  );

create policy "Users can delete own todos"
  on todo_items for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on todo_items to service_role;
