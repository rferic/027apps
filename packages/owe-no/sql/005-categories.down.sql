drop index if exists owe_no_categories_group_idx;
alter table owe_no_categories drop column if exists archived_at;
