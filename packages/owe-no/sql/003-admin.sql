-- 1.3.0 (D26): the panel administers as an administrator, so it records who
-- archived a group and who added a member, and the dashboard widget reads one
-- balance view instead of re-deriving the money rule in another query.
alter table owe_no_groups
  add column archived_by uuid references public.profiles(id) on delete set null;
alter table owe_no_members
  add column added_by uuid references public.profiles(id) on delete set null;

-- `balance = paid - owed`, the same definition as `computeBalances()`.
-- security_invoker keeps the caller's RLS when a module user reads it; the
-- panel (service_role) bypasses RLS and the widget only aggregates counts.
create view owe_no_balances
with (security_invoker = true) as
select g.id as group_id,
       m.id as member_id,
       coalesce(paid.total, 0) - coalesce(owed.total, 0) as amount_minor
  from owe_no_groups g
  join owe_no_members m on m.group_id = g.id
  left join (
    select mv.paid_by_member_id as member_id, sum(mv.amount_minor) as total
      from owe_no_movements mv
     where mv.deleted_at is null
     group by mv.paid_by_member_id
  ) paid on paid.member_id = m.id
  left join (
    select s.member_id, sum(s.amount_minor) as total
      from owe_no_movement_shares s
      join owe_no_movements mv on mv.id = s.movement_id
     where mv.deleted_at is null
     group by s.member_id
  ) owed on owed.member_id = m.id;

-- Panel widget 1: active groups, with the size of the instance as detail.
-- `uid` is ignored: this widget summarizes the instance, not one user.
create or replace function widget_metric(uid uuid) returns jsonb
language sql
stable
as $$
  with active as (select id from owe_no_groups where archived_at is null)
  select jsonb_build_object(
    'value', (select count(*) from active),
    'label', 'groups',
    'detail', '{members} members · {movements} movements',
    'params', jsonb_build_object(
      'members', (
        select count(*) from owe_no_members m join active a on a.id = m.group_id
         where m.state = 'active'
      ),
      'movements', (
        select count(*) from owe_no_movements mv join active a on a.id = mv.group_id
         where mv.deleted_at is null
      )
    )
  );
$$;

-- Panel widget 2: groups whose balances are not all zero. Counts groups, never
-- money, so currencies are not summed.
create function widget_pending(uid uuid) returns jsonb
language sql
stable
as $$
  with pending as (
    select g.id, g.currency
      from owe_no_groups g
     where g.archived_at is null
       and exists (
         select 1 from owe_no_balances b
          where b.group_id = g.id and b.amount_minor <> 0
       )
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'value', (select count(*) from pending),
    'label', 'groups with a balance',
    'detail', case
      when (select count(distinct currency) from pending) > 1
      then 'in {currencies} currencies'
    end,
    'params', jsonb_build_object(
      'currencies', (select count(distinct currency) from pending)
    )
  ));
$$;
