-- Import batches (spec §6.9): one row per committed file and one row per source
-- line, so a second import can list the duplicates and the panel can show the
-- history without re-reading the CSV.
create table owe_no_imports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  imported_by uuid references public.profiles(id) on delete set null,
  source text not null default 'splitwise',
  row_count integer not null check (row_count >= 0),
  created_count integer not null check (created_count >= 0),
  skipped_count integer not null check (skipped_count >= 0),
  error_count integer not null check (error_count >= 0),
  created_at timestamptz not null default now()
);

create table owe_no_import_rows (
  import_id uuid not null references owe_no_imports(id) on delete cascade,
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  movement_id uuid references owe_no_movements(id) on delete set null,
  primary key (import_id, row_hash)
);

create index owe_no_import_rows_hash_idx on owe_no_import_rows (row_hash);
create index owe_no_imports_group_idx on owe_no_imports (group_id, created_at desc);

alter table owe_no_imports enable row level security;
alter table owe_no_import_rows enable row level security;

create policy owe_no_imports_creator on owe_no_imports
  for select to authenticated
  using (is_group_creator(group_id));

create policy owe_no_import_rows_creator on owe_no_import_rows
  for select to authenticated
  using (exists (
    select 1 from owe_no_imports i
     where i.id = import_id and is_group_creator(i.group_id)
  ));
