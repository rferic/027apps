-- Performance indexes for common query patterns
-- Sprint 26: Performance optimization

-- group_members: lookup por user_id y group_id (auth, dashboard, layouts)
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);

-- invitations: lookup por token (accept invitation flow)
create index if not exists idx_invitations_token on public.invitations(token);

-- inspiration_requests: filtros comunes en admin list
-- (status y type ya existen de migraciones previas)
create index if not exists idx_inspiration_requests_user_id on public.inspiration_requests(user_id);

-- inspiration_votes y comments: joins frecuentes con requests
create index if not exists idx_inspiration_votes_request_id on public.inspiration_votes(request_id);
create index if not exists idx_inspiration_comments_request_id on public.inspiration_comments(request_id);

-- todo_items: filtros por grupo, status y asignado
create index if not exists idx_todo_items_group_id on public.todo_items(group_id);
create index if not exists idx_todo_items_status on public.todo_items(status);
create index if not exists idx_todo_items_assigned_to on public.todo_items(assigned_to);
create index if not exists idx_todo_items_created_by on public.todo_items(created_by);

-- installed_apps: lookup por slug (route dispatcher, layouts)
create index if not exists idx_installed_apps_slug on public.installed_apps(slug);

-- group_app_access: ya tiene unique(group_id, app_slug) que cubre lookup por group_id
