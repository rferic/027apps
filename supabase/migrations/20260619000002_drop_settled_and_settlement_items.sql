-- Remove settlement_items table (expenses are no longer linked to settlements)
drop table if exists split_expenses_settlement_items cascade;

-- Remove settled column from expenses (all expenses are always active)
alter table split_expenses_expenses drop column if exists settled;

-- Clean up orphaned indexes
drop index if exists idx_se_expenses_settled;
