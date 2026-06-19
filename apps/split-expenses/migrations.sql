-- Split Expenses: Drop old schema (idempotent)
drop table if exists split_expenses_transfers cascade;
drop table if exists split_expenses_settlement_items cascade;
drop table if exists split_expenses_settlements cascade;
drop table if exists split_expenses_shares cascade;
drop table if exists split_expenses_expenses cascade;
drop table if exists split_expenses_tags cascade;
drop table if exists split_expenses_members cascade;
drop table if exists split_expenses_groups cascade;

-- ─── Expense Groups ─────────────────────────────────────────────────────────

create table split_expenses_groups (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  emoji       text not null default '💰',
  currency    text not null default 'EUR',
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Members ────────────────────────────────────────────────────────────────

create table split_expenses_members (
  id                uuid primary key default gen_random_uuid(),
  expense_group_id  uuid not null references split_expenses_groups(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (expense_group_id, user_id)
);

-- ─── Tags ───────────────────────────────────────────────────────────────────

create table split_expenses_tags (
  id                uuid primary key default gen_random_uuid(),
  expense_group_id  uuid not null references split_expenses_groups(id) on delete cascade,
  name              text not null,
  color             text not null default '#6B7280',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (expense_group_id, name)
);

-- ─── Expenses ───────────────────────────────────────────────────────────────

create table split_expenses_expenses (
  id                uuid primary key default gen_random_uuid(),
  expense_group_id  uuid not null references split_expenses_groups(id) on delete cascade,
  title             text not null,
  amount            numeric(12,2) not null check (amount > 0),
  paid_by           uuid not null references auth.users(id),
  tag_id            uuid references split_expenses_tags(id) on delete set null,
  settled           boolean not null default false,
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Expense Shares ─────────────────────────────────────────────────────────

create table split_expenses_shares (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references split_expenses_expenses(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  amount      numeric(12,2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (expense_id, user_id)
);

-- ─── Settlements ────────────────────────────────────────────────────────────

create table split_expenses_settlements (
  id                uuid primary key default gen_random_uuid(),
  expense_group_id  uuid not null references split_expenses_groups(id) on delete cascade,
  settled_by        uuid not null references auth.users(id),
  note              text,
  created_at        timestamptz not null default now()
);

create table split_expenses_settlement_items (
  id            uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references split_expenses_settlements(id) on delete cascade,
  expense_id    uuid not null references split_expenses_expenses(id) on delete cascade,
  unique (settlement_id, expense_id)
);

-- ─── Transfers ──────────────────────────────────────────────────────────────

create table split_expenses_transfers (
  id                uuid primary key default gen_random_uuid(),
  expense_group_id  uuid not null references split_expenses_groups(id) on delete cascade,
  settlement_id     uuid references split_expenses_settlements(id) on delete set null,
  from_user         uuid not null references auth.users(id),
  to_user           uuid not null references auth.users(id),
  amount            numeric(12,2) not null check (amount > 0),
  status            text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  is_manual         boolean not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index idx_se_groups_group on split_expenses_groups(group_id);
create index idx_se_members_expense_group on split_expenses_members(expense_group_id);
create index idx_se_members_user on split_expenses_members(user_id);
create index idx_se_tags_expense_group on split_expenses_tags(expense_group_id);
create index idx_se_expenses_expense_group on split_expenses_expenses(expense_group_id);
create index idx_se_expenses_paid_by on split_expenses_expenses(paid_by);
create index idx_se_expenses_tag on split_expenses_expenses(tag_id);
create index idx_se_expenses_settled on split_expenses_expenses(expense_group_id, settled);
create index idx_se_shares_expense on split_expenses_shares(expense_id);
create index idx_se_shares_user on split_expenses_shares(user_id);
create index idx_se_settlements_expense_group on split_expenses_settlements(expense_group_id);
create index idx_se_settlement_items_settlement on split_expenses_settlement_items(settlement_id);
create index idx_se_transfers_expense_group on split_expenses_transfers(expense_group_id);
create index idx_se_transfers_settlement on split_expenses_transfers(settlement_id);
create index idx_se_transfers_from on split_expenses_transfers(from_user);
create index idx_se_transfers_to on split_expenses_transfers(to_user);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table split_expenses_groups enable row level security;
alter table split_expenses_members enable row level security;
alter table split_expenses_tags enable row level security;
alter table split_expenses_expenses enable row level security;
alter table split_expenses_shares enable row level security;
alter table split_expenses_settlements enable row level security;
alter table split_expenses_settlement_items enable row level security;
alter table split_expenses_transfers enable row level security;

-- Helper: check if user is a member of the parent 027apps group
create or replace function split_expenses_is_group_member(expense_group_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from split_expenses_groups eg
    join public.group_members gm on gm.group_id = eg.group_id
    where eg.id = expense_group_id and gm.user_id = auth.uid()
  );
$$;

-- Helper: check if user is creator or admin of the parent 027apps group
create or replace function split_expenses_is_creator_or_admin(expense_group_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from split_expenses_groups eg
    left join public.group_members gm on gm.group_id = eg.group_id and gm.user_id = auth.uid()
    where eg.id = expense_group_id
    and (eg.created_by = auth.uid() or gm.role = 'admin')
  );
$$;

-- ── Groups ─────────────────────────────────────────────────────────────

create policy "Group members can view expense groups"
  on split_expenses_groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid() and gm.group_id = split_expenses_groups.group_id
    )
  );

create policy "Group members can create expense groups"
  on split_expenses_groups for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid() and gm.group_id = split_expenses_groups.group_id
    )
  );

create policy "Creator or admin can update expense groups"
  on split_expenses_groups for update
  using (split_expenses_is_creator_or_admin(id));

create policy "Creator or admin can delete expense groups"
  on split_expenses_groups for delete
  using (split_expenses_is_creator_or_admin(id));

-- ── Members ────────────────────────────────────────────────────────────

create policy "Group members can view expense group members"
  on split_expenses_members for select
  using (split_expenses_is_group_member(expense_group_id));

create policy "Group members can add members"
  on split_expenses_members for insert
  with check (split_expenses_is_group_member(expense_group_id));

create policy "Creator or admin can update members"
  on split_expenses_members for update
  using (split_expenses_is_creator_or_admin(expense_group_id));

create policy "Creator or admin can delete members"
  on split_expenses_members for delete
  using (split_expenses_is_creator_or_admin(expense_group_id));

-- ── Tags ───────────────────────────────────────────────────────────────

create policy "Group members can view tags"
  on split_expenses_tags for select
  using (split_expenses_is_group_member(expense_group_id));

create policy "Group members can create tags"
  on split_expenses_tags for insert
  with check (split_expenses_is_group_member(expense_group_id));

create policy "Creator or admin can update tags"
  on split_expenses_tags for update
  using (split_expenses_is_creator_or_admin(expense_group_id));

create policy "Creator or admin can delete tags"
  on split_expenses_tags for delete
  using (split_expenses_is_creator_or_admin(expense_group_id));

-- ── Expenses ───────────────────────────────────────────────────────────

create policy "Group members can view expenses"
  on split_expenses_expenses for select
  using (split_expenses_is_group_member(expense_group_id));

create policy "Group members can create expenses"
  on split_expenses_expenses for insert
  with check (
    auth.uid() = created_by
    and split_expenses_is_group_member(expense_group_id)
  );

create policy "Creator or admin can update expenses"
  on split_expenses_expenses for update
  using (split_expenses_is_creator_or_admin(expense_group_id));

create policy "Creator or admin can delete expenses"
  on split_expenses_expenses for delete
  using (split_expenses_is_creator_or_admin(expense_group_id));

-- ── Shares ─────────────────────────────────────────────────────────────

create policy "Group members can view shares"
  on split_expenses_shares for select
  using (
    exists (
      select 1 from split_expenses_expenses e
      where e.id = split_expenses_shares.expense_id
      and split_expenses_is_group_member(e.expense_group_id)
    )
  );

create policy "Group members can create shares"
  on split_expenses_shares for insert
  with check (
    exists (
      select 1 from split_expenses_expenses e
      where e.id = split_expenses_shares.expense_id
      and split_expenses_is_group_member(e.expense_group_id)
    )
  );

create policy "Creator or admin can update shares"
  on split_expenses_shares for update
  using (
    exists (
      select 1 from split_expenses_expenses e
      where e.id = split_expenses_shares.expense_id
      and split_expenses_is_creator_or_admin(e.expense_group_id)
    )
  );

create policy "Creator or admin can delete shares"
  on split_expenses_shares for delete
  using (
    exists (
      select 1 from split_expenses_expenses e
      where e.id = split_expenses_shares.expense_id
      and split_expenses_is_creator_or_admin(e.expense_group_id)
    )
  );

-- ── Settlements ────────────────────────────────────────────────────────

create policy "Group members can view settlements"
  on split_expenses_settlements for select
  using (split_expenses_is_group_member(expense_group_id));

create policy "Group members can create settlements"
  on split_expenses_settlements for insert
  with check (
    auth.uid() = settled_by
    and split_expenses_is_group_member(expense_group_id)
  );

create policy "Creator or admin can delete settlements"
  on split_expenses_settlements for delete
  using (split_expenses_is_creator_or_admin(expense_group_id));

-- ── Settlement items ───────────────────────────────────────────────────

create policy "Group members can view settlement items"
  on split_expenses_settlement_items for select
  using (
    exists (
      select 1 from split_expenses_settlements s
      where s.id = split_expenses_settlement_items.settlement_id
      and split_expenses_is_group_member(s.expense_group_id)
    )
  );

create policy "Group members can create settlement items"
  on split_expenses_settlement_items for insert
  with check (
    exists (
      select 1 from split_expenses_settlements s
      where s.id = split_expenses_settlement_items.settlement_id
      and split_expenses_is_group_member(s.expense_group_id)
    )
  );

-- ── Transfers ──────────────────────────────────────────────────────────

create policy "Group members can view transfers"
  on split_expenses_transfers for select
  using (split_expenses_is_group_member(expense_group_id));

create policy "Group members can create transfers"
  on split_expenses_transfers for insert
  with check (split_expenses_is_group_member(expense_group_id));

create policy "Creator or admin can update transfers"
  on split_expenses_transfers for update
  using (split_expenses_is_creator_or_admin(expense_group_id));

create policy "Creator or admin can delete transfers"
  on split_expenses_transfers for delete
  using (split_expenses_is_creator_or_admin(expense_group_id));

-- ─── Grants ────────────────────────────────────────────────────────────────

grant select, insert, update, delete on split_expenses_groups to service_role;
grant select, insert, update, delete on split_expenses_members to service_role;
grant select, insert, update, delete on split_expenses_tags to service_role;
grant select, insert, update, delete on split_expenses_expenses to service_role;
grant select, insert, update, delete on split_expenses_shares to service_role;
grant select, insert, update, delete on split_expenses_settlements to service_role;
grant select, insert, update, delete on split_expenses_settlement_items to service_role;
grant select, insert, update, delete on split_expenses_transfers to service_role;
