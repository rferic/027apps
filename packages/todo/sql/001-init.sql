-- 1.0.0 — Tareas (spec 2026-11-27-todo.md §3).
--
-- Writes never come through PostgREST: every policy below grants SELECT to a
-- group member and nothing else. The API talks to this schema with service_role,
-- where the domain decides who may edit, complete or delete. A task has one
-- holder or none, and there are no creator privileges.
--
-- Every foreign key to profiles is `on delete set null` (D16): purging a user
-- removes the account and leaves the module rows without a user_id.

create table todo_groups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 60),
  kind              text not null default 'group' check (kind in ('group', 'personal')),
  owner_id          uuid references public.profiles(id) on delete set null,
  timezone          text not null default 'Europe/Madrid',
  power_enabled     boolean not null default false,
  power_period      text not null default 'infinite'
                    check (power_period in ('infinite', 'weekly', 'monthly', 'yearly')),
  season_number     int not null default 1 check (season_number > 0),
  season_started_on date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint todo_groups_personal_no_power
    check (kind <> 'personal' or (power_enabled = false and power_period = 'infinite'))
);
create unique index todo_groups_one_personal on todo_groups (owner_id) where kind = 'personal';

create table todo_group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references todo_groups(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete set null,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create unique index todo_group_members_one_owner on todo_group_members (group_id)
  where role = 'owner';

-- The catalog is the only table without group_id: it belongs to the instance,
-- the panel administers it and every group shares it (spec §3.2).
create table todo_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  emoji      text not null default '📌' check (char_length(emoji) between 1 and 8),
  color      text not null default 'slate'
             check (color in ('teal','indigo','violet','amber','rose','emerald','sky','slate')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (name)
);

create table todo_tasks (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references todo_groups(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  notes         text check (notes is null or char_length(notes) <= 2000),
  category_id   uuid references todo_categories(id) on delete set null,
  power         int check (power between 1 and 5),
  assignee_id   uuid references public.profiles(id) on delete set null,
  state         text not null default 'pending' check (state in ('pending', 'done')),
  recurrence    text not null default 'none'
                check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  keep_assignee boolean not null default false,
  due_on        date,
  period_start  date,
  period_end    date,
  completed_at  timestamptz,
  completed_by  uuid references public.profiles(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint todo_tasks_done_complete
    check (state <> 'done' or completed_at is not null),
  constraint todo_tasks_one_off
    check (recurrence <> 'none' or (period_start is null and period_end is null)),
  constraint todo_tasks_periodic
    check (recurrence = 'none' or (due_on is null and period_start is not null
                                   and period_end is not null and period_end >= period_start))
);
create index todo_tasks_group_state on todo_tasks (group_id, state);
create index todo_tasks_group_assignee on todo_tasks (group_id, assignee_id);
create index todo_tasks_due on todo_tasks (due_on) where state = 'pending';

create table todo_task_occurrences (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references todo_groups(id) on delete cascade,
  task_id      uuid not null references todo_tasks(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  outcome      text not null check (outcome in ('done', 'missed')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (task_id, period_start),
  constraint todo_occurrences_done_complete
    check (outcome <> 'done' or completed_at is not null)
);
create index todo_occurrences_group on todo_task_occurrences (group_id, period_start);

create table todo_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references todo_groups(id) on delete cascade,
  task_id      uuid not null references todo_tasks(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete set null,
  decided_by   uuid references public.profiles(id) on delete set null,
  state        text not null default 'pending'
               check (state in ('pending', 'accepted', 'denied', 'expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  resolved_at  timestamptz
);
create unique index todo_requests_one_pending on todo_requests (task_id) where state = 'pending';
create index todo_requests_inbox on todo_requests (group_id, state, created_at desc);

create table todo_power_totals (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references todo_groups(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  season_number int not null check (season_number > 0),
  points        int not null default 0 check (points >= 0),
  tasks_done    int not null default 0 check (tasks_done >= 0),
  updated_at    timestamptz not null default now(),
  unique (group_id, user_id, season_number)
);

create table todo_seasons (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references todo_groups(id) on delete cascade,
  number     int not null check (number > 0),
  period     text not null check (period in ('infinite', 'weekly', 'monthly', 'yearly')),
  started_on date not null,
  closed_on  date,
  closed_by  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, number)
);

create table todo_season_results (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references todo_seasons(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  points     int not null check (points >= 0),
  tasks_done int not null check (tasks_done >= 0),
  position   int not null check (position > 0),
  unique (season_id, user_id)
);

create table todo_idempotency (
  id         uuid primary key default gen_random_uuid(),
  key        text not null check (char_length(key) between 8 and 120),
  user_id    uuid references public.profiles(id) on delete set null,
  endpoint   text not null,
  response   jsonb not null,
  created_at timestamptz not null default now(),
  unique (key, user_id)
);

alter table todo_groups enable row level security;
alter table todo_group_members enable row level security;
alter table todo_categories enable row level security;
alter table todo_tasks enable row level security;
alter table todo_task_occurrences enable row level security;
alter table todo_requests enable row level security;
alter table todo_power_totals enable row level security;
alter table todo_seasons enable row level security;
alter table todo_season_results enable row level security;
alter table todo_idempotency enable row level security;

-- The policies of `todo_group_members` cannot read that table through a helper:
-- the helper would re-enter its own policy. This view belongs to the installer,
-- reads without RLS and returns only the caller's rows, so a helper may ask
-- "is this group mine?" without recursing.
create view todo_my_membership as
  select m.group_id, m.user_id, m.role
    from module_todo.todo_group_members m
   where m.user_id = public.core_current_user_id();

create function is_todo_member(gid uuid) returns boolean
language sql
stable
as $$
  select exists (select 1 from module_todo.todo_my_membership v where v.group_id = gid);
$$;

create function is_todo_owner(gid uuid) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from module_todo.todo_my_membership v
     where v.group_id = gid and v.role = 'owner'
  );
$$;

-- The channel the push pipeline publishes to: one topic per group.
create function channel_members(topic text) returns setof uuid
language sql
stable
as $$
  select m.user_id
    from module_todo.todo_group_members m
   where m.user_id is not null
     and topic = 'todo-group-' || m.group_id::text;
$$;

create policy todo_groups_read on todo_groups
  for select to authenticated
  using (is_todo_member(id));

create policy todo_group_members_read on todo_group_members
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_categories_read on todo_categories
  for select to authenticated
  using (true);

create policy todo_tasks_read on todo_tasks
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_occurrences_read on todo_task_occurrences
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_requests_read on todo_requests
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_power_totals_read on todo_power_totals
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_seasons_read on todo_seasons
  for select to authenticated
  using (is_todo_member(group_id));

create policy todo_season_results_read on todo_season_results
  for select to authenticated
  using (
    exists (
      select 1 from module_todo.todo_seasons s
       where s.id = season_id and is_todo_member(s.group_id)
    )
  );
