-- 1.4.0: the panel widgets speak in labels, not in pluralized English
-- ("1 groups" was wrong). The value carries the number; the detail carries the
-- context, translated by the panel with the module's locales.
create or replace function widget_metric(uid uuid) returns jsonb
language sql
stable
as $$
  with active as (select id from owe_no_groups where archived_at is null)
  select jsonb_build_object(
    'value', (select count(*) from active),
    'detail', 'Members {members} · Movements {movements}',
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

create or replace function widget_pending(uid uuid) returns jsonb
language sql
stable
as $$
  with pending as (
    select g.id
      from owe_no_groups g
     where g.archived_at is null
       and exists (
         select 1 from owe_no_balances b
          where b.group_id = g.id and b.amount_minor <> 0
       )
  )
  select jsonb_build_object('value', (select count(*) from pending));
$$;
