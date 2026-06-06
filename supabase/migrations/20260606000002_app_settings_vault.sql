-- Global app settings (not per-group)
create table if not exists public.app_settings (
    key         text primary key,
    value       jsonb not null,
    updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

grant select, insert, update, delete on public.app_settings to authenticated, service_role;

create policy "Admins can manage app_settings"
    on public.app_settings
    for all
    using (
        exists (
            select 1 from public.group_members
            where user_id = auth.uid() and role = 'admin'
        )
    );
