-- Migration: remove group_id from inspiration_requests (global ideas, not group-scoped)
alter table inspiration_requests drop column if exists group_id;
drop index if exists idx_inspiration_requests_group;

-- Drop old group-scoped RLS policies (renamed below)
drop policy if exists "Members can view requests in their group" on inspiration_requests;
drop policy if exists "Members can create requests in their group" on inspiration_requests;
drop policy if exists "Admin can update any request in their group" on inspiration_requests;
drop policy if exists "Admin can delete any request in their group" on inspiration_requests;
drop policy if exists "Members can view votes in their group" on inspiration_votes;
drop policy if exists "Users can vote on requests in their group" on inspiration_votes;
drop policy if exists "Members can view comments in their group" on inspiration_comments;
drop policy if exists "Members can comment on requests in their group" on inspiration_comments;

-- ENUM types (idempotent — safe to run multiple times)
do $$ begin
  create type inspiration_type as enum (
    'bug',
    'improvement',
    'new_app',
    'new_app_feature',
    'new_general_functionality',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type inspiration_status as enum (
    'pending',
    'reviewing',
    'approved',
    'in_progress',
    'completed',
    'rejected',
    'on_hold',
    'duplicate'
  );
exception when duplicate_object then null;
end $$;

-- Tabla principal
create table if not exists inspiration_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  title             text not null,
  description       text not null default '',
  type              inspiration_type not null,
  status            inspiration_status not null default 'pending',
  app_slug          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indices para busqueda y filtros
create index idx_inspiration_requests_status on inspiration_requests(status);
create index idx_inspiration_requests_type on inspiration_requests(type);
create index idx_inspiration_requests_search on inspiration_requests using gin (to_tsvector('simple', title || ' ' || description));

-- Tabla de votos
create table if not exists inspiration_votes (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references inspiration_requests on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  created_at    timestamptz not null default now(),
  unique(request_id, user_id)
);

create index idx_inspiration_votes_request on inspiration_votes(request_id);

-- Tabla de comentarios
create table if not exists inspiration_comments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references inspiration_requests on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_inspiration_comments_request on inspiration_comments(request_id);

-- Grant permissions to service_role (needed for admin client queries via PostgREST)
grant select, insert, update, delete on inspiration_requests to service_role;
grant select, insert, update, delete on inspiration_votes to service_role;
grant select, insert, update, delete on inspiration_comments to service_role;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table inspiration_requests enable row level security;
alter table inspiration_votes enable row level security;
alter table inspiration_comments enable row level security;

-- inspiration_requests: SELECT para cualquier usuario autenticado
create policy "Members can view all requests"
  on inspiration_requests for select
  using (auth.role() = 'authenticated');

-- inspiration_requests: INSERT para cualquier usuario autenticado
create policy "Members can create requests"
  on inspiration_requests for insert
  with check (auth.role() = 'authenticated');

-- inspiration_requests: UPDATE - admin puede cambiar status, creador puede editar sus campos
create policy "Admin can update any request"
  on inspiration_requests for update
  using (
    exists (
      select 1 from group_members
      where group_members.user_id = auth.uid()
        and group_members.role = 'admin'
    )
  );

create policy "Creator can update own requests"
  on inspiration_requests for update
  using (user_id = auth.uid());

-- inspiration_requests: DELETE - creador o admin
create policy "Creator can delete own requests"
  on inspiration_requests for delete
  using (user_id = auth.uid());

create policy "Admin can delete any request"
  on inspiration_requests for delete
  using (
    exists (
      select 1 from group_members
      where group_members.user_id = auth.uid()
        and group_members.role = 'admin'
    )
  );

-- inspiration_votes: SELECT para cualquier usuario autenticado
create policy "Members can view all votes"
  on inspiration_votes for select
  using (auth.role() = 'authenticated');

-- inspiration_votes: INSERT/DELETE para el propio usuario
create policy "Users can vote on requests"
  on inspiration_votes for insert
  with check (
    user_id = auth.uid()
    and auth.role() = 'authenticated'
  );

create policy "Users can remove their own votes"
  on inspiration_votes for delete
  using (user_id = auth.uid());

-- inspiration_comments: SELECT para cualquier usuario autenticado
create policy "Members can view all comments"
  on inspiration_comments for select
  using (auth.role() = 'authenticated');

-- inspiration_comments: INSERT para cualquier usuario autenticado
create policy "Members can comment on requests"
  on inspiration_comments for insert
  with check (auth.role() = 'authenticated');

-- inspiration_comments: UPDATE/DELETE solo para el creador del comentario
create policy "Users can update their own comments"
  on inspiration_comments for update
  using (user_id = auth.uid());

create policy "Users can delete their own comments"
  on inspiration_comments for delete
  using (user_id = auth.uid());
