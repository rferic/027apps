-- Reverse 001-init.sql. Order matters:
--   * the view reads the tables, so it goes first;
--   * the tables go next, because their RLS policies call the helper functions
--     and a function cannot be dropped while a policy still uses it;
--   * the functions (widgets, helpers, demo hooks) go last.
drop view if exists owe_no_my_membership;
drop table if exists owe_no_movement_shares;
drop table if exists owe_no_movements;
drop table if exists owe_no_categories;
drop table if exists owe_no_blocks;
drop table if exists owe_no_members;
drop table if exists owe_no_groups;
drop function if exists widget_summary(uuid);
drop function if exists widget_metric(uuid);
drop function if exists channel_members(text);
drop function if exists is_group_active_member(uuid);
drop function if exists is_group_creator(uuid);
drop function if exists is_group_member(uuid);
drop function if exists clear_demo();
drop function if exists seed_demo(jsonb);
