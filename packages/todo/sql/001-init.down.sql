-- Reverse 001-init.sql. Order matters: the view reads the membership table, so
-- it goes first; the tables next, because their policies call the helpers; the
-- helpers last. The schema itself is dropped by the installer.
drop view if exists todo_my_membership;
drop table if exists todo_idempotency;
drop table if exists todo_season_results;
drop table if exists todo_seasons;
drop table if exists todo_power_totals;
drop table if exists todo_requests;
drop table if exists todo_task_occurrences;
drop table if exists todo_tasks;
drop table if exists todo_categories;
drop table if exists todo_group_members;
drop table if exists todo_groups;
drop function if exists channel_members(text);
drop function if exists is_todo_owner(uuid);
drop function if exists is_todo_member(uuid);
