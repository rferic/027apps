-- OweNo v1 (spec 2026-11-13 §5.1): groups, members, blocks, categories, one
-- movement table for expenses and settlements, and its shares.
create table owe_no_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table owe_no_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  state text not null default 'invited' check (state in ('invited', 'active', 'left', 'removed')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owe_no_members_unique_user unique (group_id, user_id)
);

create table owe_no_blocks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  blocked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table owe_no_categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  color_slot text not null default 'teal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

create table owe_no_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  kind text not null check (kind in ('expense', 'settlement')),
  description text not null check (length(btrim(description)) between 1 and 200),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_by_member_id uuid not null references owe_no_members(id),
  category_id uuid references owe_no_categories(id) on delete set null,
  occurred_on date not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table owe_no_movement_shares (
  movement_id uuid not null references owe_no_movements(id) on delete cascade,
  member_id uuid not null references owe_no_members(id),
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (movement_id, member_id)
);

create index owe_no_members_group_state_idx on owe_no_members (group_id, state);
create index owe_no_movements_group_day_idx
  on owe_no_movements (group_id, occurred_on desc)
  where deleted_at is null;
create index owe_no_shares_member_idx on owe_no_movement_shares (member_id);

-- Demo hooks (contract `demo`): the Core passes its dataset ids and expects
-- counts back. Clearing only removes what this module added.
create function seed_demo(ids jsonb) returns jsonb
language plpgsql
as $$
begin
  return jsonb_build_object('groups', 0);
end;
$$;

create function clear_demo() returns jsonb
language plpgsql
as $$
begin
  return jsonb_build_object('groups', 0);
end;
$$;

-- Dashboard widgets (contract `dashboard_widgets`): the app gets a summary of
-- the caller's groups, the panel a count of pending settlements.
create function widget_summary(uid uuid) returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'value', count(distinct m.group_id),
    'label', 'groups'
  )
  from module_owe_no.owe_no_members m
  where m.user_id = uid and m.state = 'active';
$$;

create function widget_metric(uid uuid) returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'value', count(*),
    'label', 'groups'
  )
  from module_owe_no.owe_no_groups g
  where g.archived_at is null;
$$;

-- Realtime channel membership: only active members of the group subscribe.
create function channel_members(topic text) returns setof uuid
language sql
stable
as $$
  select m.user_id
    from module_owe_no.owe_no_members m
   where m.state = 'active'
     and m.user_id is not null
     and topic = 'owe-no-group-' || m.group_id::text;
$$;

-- RLS (spec §5.4): visibility by membership state, writes by role. The identity
-- comes from the Core helper; this SQL never touches `auth`.
alter table owe_no_groups enable row level security;
alter table owe_no_members enable row level security;
alter table owe_no_blocks enable row level security;
alter table owe_no_categories enable row level security;
alter table owe_no_movements enable row level security;
alter table owe_no_movement_shares enable row level security;

-- The policies of `owe_no_members` cannot read that table through a helper: the
-- helper would re-enter its own policy. A view owned by the installer reads it
-- without RLS and filters by the caller, so a helper can ask "is this group
-- mine?" without recursing. Every row the view can return belongs to the caller.
create view owe_no_my_membership as
  select m.group_id, m.state
    from module_owe_no.owe_no_members m
   where m.user_id = public.core_current_user_id();

create function is_group_member(gid uuid) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from module_owe_no.owe_no_my_membership v
     where v.group_id = gid
       and v.state in ('invited', 'active')
  );
$$;

create function is_group_active_member(gid uuid) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from module_owe_no.owe_no_my_membership v
     where v.group_id = gid
       and v.state = 'active'
  );
$$;

create function is_group_creator(gid uuid) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from module_owe_no.owe_no_groups g
     where g.id = gid
       and g.created_by = public.core_current_user_id()
  );
$$;

create policy owe_no_groups_read on owe_no_groups
  for select to authenticated
  -- The creator sees the group before being a member of it, which is what makes
  -- `insert ... returning` usable when the group is created.
  using (is_group_member(id) or created_by = public.core_current_user_id());

create policy owe_no_groups_insert on owe_no_groups
  for insert to authenticated
  with check (created_by = public.core_current_user_id());

create policy owe_no_groups_update on owe_no_groups
  for update to authenticated
  using (is_group_creator(id))
  with check (is_group_creator(id));

create policy owe_no_members_read on owe_no_members
  for select to authenticated
  using (is_group_member(group_id));

create policy owe_no_members_write on owe_no_members
  for all to authenticated
  using (is_group_creator(group_id))
  with check (is_group_creator(group_id));

create policy owe_no_blocks_creator on owe_no_blocks
  for all to authenticated
  using (is_group_creator(group_id))
  with check (is_group_creator(group_id));

create policy owe_no_categories_read on owe_no_categories
  for select to authenticated
  using (is_group_active_member(group_id));

create policy owe_no_categories_write on owe_no_categories
  for all to authenticated
  using (is_group_active_member(group_id))
  with check (is_group_active_member(group_id));

create policy owe_no_movements_read on owe_no_movements
  for select to authenticated
  using (is_group_active_member(group_id));

create policy owe_no_movements_write on owe_no_movements
  for all to authenticated
  using (is_group_active_member(group_id))
  with check (is_group_active_member(group_id));

create policy owe_no_shares_read on owe_no_movement_shares
  for select to authenticated
  using (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ));

create policy owe_no_shares_write on owe_no_movement_shares
  for all to authenticated
  using (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ))
  with check (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ));
