-- Back to the policies of 001-init.sql (wide writes for an active member).
drop policy if exists owe_no_members_read on owe_no_members;
create policy owe_no_members_read on owe_no_members
  for select to authenticated
  using (is_group_member(group_id));

drop policy if exists owe_no_members_creator on owe_no_members;
drop policy if exists owe_no_members_self on owe_no_members;
create policy owe_no_members_write on owe_no_members
  for all to authenticated
  using (is_group_creator(group_id))
  with check (is_group_creator(group_id));

drop policy if exists owe_no_movements_read on owe_no_movements;
create policy owe_no_movements_read on owe_no_movements
  for select to authenticated
  using (is_group_active_member(group_id));

drop policy if exists owe_no_movements_insert on owe_no_movements;
drop policy if exists owe_no_movements_update on owe_no_movements;
create policy owe_no_movements_write on owe_no_movements
  for all to authenticated
  using (is_group_active_member(group_id))
  with check (is_group_active_member(group_id));

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
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ))
  with check (exists (
    select 1 from module_owe_no.owe_no_movements mv
     where mv.id = movement_id and is_group_active_member(mv.group_id)
  ));

drop policy if exists owe_no_categories_write on owe_no_categories;
create policy owe_no_categories_write on owe_no_categories
  for all to authenticated
  using (is_group_active_member(group_id))
  with check (is_group_active_member(group_id));
