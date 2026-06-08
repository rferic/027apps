-- Drop old schema
drop table if exists todo_items cascade;

-- Categories (global, managed by admin)
create table todo_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  emoji         text not null default '📌',
  color         text not null default '#6B7280',
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Items
create table todo_items (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  title         text not null,
  description   text,
  visibility    text not null default 'public' check (visibility in ('public', 'private')),
  status        text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category_id   uuid references todo_categories(id) on delete set null,
  assigned_to   uuid references auth.users(id) on delete set null,
  created_by    uuid not null references auth.users(id) on delete cascade,
  due_date      timestamptz,
  completed_at  timestamptz,
  repeat_interval text check (repeat_interval in ('weekly', 'monthly', 'yearly')),
  repeat_end_date timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Notification preferences per user
create table todo_notification_prefs (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  on_assigned      boolean not null default true,
  on_status_change boolean not null default false,
  on_updated       boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- Indexes
create index idx_todo_items_group_assigned  on todo_items(group_id, assigned_to);
create index idx_todo_items_group_visibility on todo_items(group_id, visibility);
create index idx_todo_items_due_date         on todo_items(due_date);
create index idx_todo_items_category         on todo_items(category_id);
create index idx_todo_items_status           on todo_items(status);
create index idx_todo_items_priority         on todo_items(priority);

-- RLS
alter table todo_items enable row level security;
alter table todo_categories enable row level security;
alter table todo_notification_prefs enable row level security;

-- todo_items: SELECT — own items OR public items in user's groups
create policy "Users can read own or group public todos"
  on todo_items for select
  using (
    auth.uid() = created_by
    or (
      visibility = 'public'
      and exists (
        select 1 from public.group_members gm
        where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id
      )
    )
  );

-- todo_items: INSERT — any group member
create policy "Group members can insert todos"
  on todo_items for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id
    )
  );

-- todo_items: UPDATE — creator or admin of the group
create policy "Creator or admin can update todos"
  on todo_items for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id and gm.role = 'admin'
    )
  );

-- todo_items: DELETE — creator or admin of the group
create policy "Creator or admin can delete todos"
  on todo_items for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid() and gm.group_id = todo_items.group_id and gm.role = 'admin'
    )
  );

-- todo_categories: SELECT — any authenticated user
create policy "Any user can read categories"
  on todo_categories for select
  to authenticated using (true);

-- todo_notification_prefs: SELECT/INSERT/UPDATE — own prefs
create policy "Users can manage own notification prefs"
  on todo_notification_prefs for all
  using (auth.uid() = user_id);

-- Recurrence columns for existing installations
alter table todo_items add column if not exists repeat_interval text check (repeat_interval in ('weekly', 'monthly', 'yearly'));
alter table todo_items add column if not exists repeat_end_date timestamptz;

-- Grant service_role access
grant select, insert, update, delete on todo_items to service_role;
grant select, insert, update, delete on todo_categories to service_role;
grant select, insert, update, delete on todo_notification_prefs to service_role;
