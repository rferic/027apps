-- 1.6.0: categories are managed by the group's members and archived instead of
-- deleted, so an old movement never loses the label it was filed under.
alter table owe_no_categories add column if not exists archived_at timestamptz;
create index if not exists owe_no_categories_group_idx on owe_no_categories (group_id);
