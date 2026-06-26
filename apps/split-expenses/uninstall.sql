drop table if exists split_expenses_transfers cascade;
drop table if exists split_expenses_settlement_items cascade;
drop table if exists split_expenses_settlements cascade;
drop table if exists split_expenses_shares cascade;
drop table if exists split_expenses_expenses cascade;
drop table if exists split_expenses_tags cascade;
drop table if exists split_expenses_members cascade;
drop table if exists split_expenses_groups cascade;

drop function if exists split_expenses_is_group_member;
drop function if exists split_expenses_is_creator_or_admin;
