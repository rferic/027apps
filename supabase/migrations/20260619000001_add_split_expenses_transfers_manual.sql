alter table split_expenses_transfers add column if not exists is_manual boolean not null default false;
alter table split_expenses_transfers add column if not exists note text;
