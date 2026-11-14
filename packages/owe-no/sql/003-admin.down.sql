drop function if exists widget_pending(uuid);
drop view if exists owe_no_balances;
alter table owe_no_members drop column if exists added_by;
alter table owe_no_groups drop column if exists archived_by;
