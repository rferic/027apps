-- Add group_id column to inspiration_requests if not exists
alter table if exists inspiration_requests
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

-- Create index for faster lookups
create index if not exists inspiration_requests_group_id_idx on inspiration_requests(group_id);
