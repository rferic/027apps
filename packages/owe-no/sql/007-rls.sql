-- 1.8.0 — policies that match the domain.
--
-- The API talks to this schema with `service_role`, so RLS is the second line:
-- exactly the case a direct PostgREST query or a future client would hit. It was
-- written before the rules settled and disagreed with them: an invited account
-- could read the whole census and could not accept, and any member could rewrite
-- another member's movement. This migration splits the writes by operation and
-- by who is doing them.

-- Members: the census is for active members; an invited one only sees its own row.
drop policy if exists owe_no_members_read on owe_no_members;
create policy owe_no_members_read on owe_no_members
  for select to authenticated
  using (is_group_active_member(group_id) or user_id = public.core_current_user_id());

-- The creator manages membership; a member may only change its own row, which is
-- what accepting, declining and leaving need.
drop policy if exists owe_no_members_write on owe_no_members;
create policy owe_no_members_creator on owe_no_members
  for all to authenticated
  using (is_group_creator(group_id))
  with check (is_group_creator(group_id));
create policy owe_no_members_self on owe_no_members
  for update to authenticated
  using (user_id = public.core_current_user_id())
  with check (user_id = public.core_current_user_id());

-- Movements: reading needs an active membership; writing needs an open group,
-- and editing is the author's or the creator's call. There is no DELETE policy
-- because a movement is never deleted: `deleted_at` is set by an update.
drop policy if exists owe_no_movements_read on owe_no_movements;
create policy owe_no_movements_read on owe_no_movements
  for select to authenticated
  using (is_group_active_member(group_id));

drop policy if exists owe_no_movements_write on owe_no_movements;

create policy owe_no_movements_insert on owe_no_movements
  for insert to authenticated
  with check (
    is_group_active_member(group_id)
    and exists (
      select 1 from module_owe_no.owe_no_groups g
       where g.id = group_id and g.archived_at is null
    )
  );

create policy owe_no_movements_update on owe_no_movements
  for update to authenticated
  using (
    (created_by = public.core_current_user_id() or is_group_creator(group_id))
    and exists (
      select 1 from module_owe_no.owe_no_groups g
       where g.id = group_id and g.archived_at is null
    )
  )
  with check (
    (created_by = public.core_current_user_id() or is_group_creator(group_id))
    and exists (
      select 1 from module_owe_no.owe_no_groups g
       where g.id = group_id and g.archived_at is null
    )
  );

-- Shares follow their movement: reading by active membership, writing only where
-- the movement could be written.
drop policy if exists owe_no_shares_read on owe_no_movement_shares;
create policy owe_no_shares_read on owe_no_movement_shares
  for select to authenticated
  using (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ));

drop policy if exists owe_no_shares_write on owe_no_movement_shares;
create policy owe_no_shares_write on owe_no_movement_shares
  for all to authenticated
  using (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id
       and (mv.created_by = public.core_current_user_id() or is_group_creator(mv.group_id))
       and exists (
         select 1 from module_owe_no.owe_no_groups g
          where g.id = mv.group_id and g.archived_at is null
       )
  ))
  with check (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id
       and (mv.created_by = public.core_current_user_id() or is_group_creator(mv.group_id))
       and exists (
         select 1 from module_owe_no.owe_no_groups g
          where g.id = mv.group_id and g.archived_at is null
       )
  ));

-- Categories: an archived group is read-only.
drop policy if exists owe_no_categories_write on owe_no_categories;
create policy owe_no_categories_write on owe_no_categories
  for all to authenticated
  using (
    is_group_active_member(group_id)
    and exists (
      select 1 from module_owe_no.owe_no_groups g
       where g.id = group_id and g.archived_at is null
    )
  )
  with check (
    is_group_active_member(group_id)
    and exists (
      select 1 from module_owe_no.owe_no_groups g
       where g.id = group_id and g.archived_at is null
    )
  );
