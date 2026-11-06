-- Sprint-06 task-06: realtime channels, transactional outbox and maintenance.
-- One subscription policy (permissive policies combine with OR) + core_cron role.

create table public.module_channels (
  module_key text not null references public.module_registry (key) on delete cascade,
  pattern text not null unique check (pattern ~ '^[a-z0-9][a-z0-9-]*(\{[a-z_]+\})?$'),
  members_fn text not null check (members_fn ~ '^[a-z][a-z0-9_]{0,62}$'),
  created_at timestamptz not null default now(),
  primary key (module_key, pattern)
);

create table public.event_outbox (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid,
  module_key text references public.module_registry (key) on delete cascade,
  type text not null,
  target text not null,
  subject_id uuid,
  resource jsonb not null,
  payload jsonb,
  notify text[],
  state text not null default 'pending' check (state in ('pending', 'published', 'failed')),
  claimed_until timestamptz,
  failed_at timestamptz,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  hook_applied text[],
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.maintenance_runs (
  run_id uuid not null default gen_random_uuid(),
  job text not null,
  status text not null check (status in ('running', 'ok', 'failed', 'skipped', 'timeout')),
  lease_until timestamptz,
  summary jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (run_id, job)
);
create unique index maintenance_runs_one_running_idx
  on public.maintenance_runs (job) where status = 'running';

alter table public.module_channels enable row level security;
alter table public.event_outbox enable row level security;
alter table public.maintenance_runs enable row level security;

grant select on public.module_channels to authenticated;
grant select on public.event_outbox to authenticated;
grant select on public.maintenance_runs to authenticated;
grant all on public.module_channels to service_role;
grant all on public.event_outbox to service_role;
grant all on public.maintenance_runs to service_role;

create policy module_channels_select on public.module_channels
  for select to authenticated using (true);
create policy event_outbox_select on public.event_outbox
  for select to authenticated using (public.core_is_super_admin());
create policy maintenance_runs_select on public.maintenance_runs
  for select to authenticated using (public.core_is_super_admin());

create index event_outbox_pending_idx
  on public.event_outbox (next_attempt_at, created_at) where state = 'pending';
create index event_outbox_state_idx on public.event_outbox (state, created_at);

-- One subscription policy: fixed topics + module channels with a live
-- members_fn check. Any failure (missing function, disabled module) denies.
create or replace function public.core_can_subscribe(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  channel record;
  allowed boolean;
begin
  if topic = 'admins' then
    return public.core_is_admin();
  end if;
  if topic = 'all' then
    return uid is not null;
  end if;
  if topic like 'user-%' then
    return uid::text = substring(topic from 6);
  end if;

  for channel in
    select c.members_fn, c.pattern
      from public.module_channels c
      join public.module_registry m on m.key = c.module_key
     where m.state = 'active'
       and topic ~ ('^' || replace(c.pattern, '{id}', '[0-9a-f-]{36}') || '$')
  loop
    begin
      execute format(
        'select exists (select 1 from public.%I($1) as t(member) where t.member = $2)',
        channel.members_fn
      ) into allowed using topic, uid;
      if coalesce(allowed, false) then
        return true;
      end if;
    exception when others then
      -- Fail closed: a broken members_fn never grants access.
      return false;
    end;
  end loop;

  return false;
end;
$$;

revoke execute on function public.core_can_subscribe(text) from public, anon;
grant execute on function public.core_can_subscribe(text) to authenticated;

-- Realtime subscription policy (created once by the Core).
drop policy if exists core_can_subscribe on realtime.messages;
create policy core_can_subscribe on realtime.messages
  for select to authenticated
  using (public.core_can_subscribe(realtime.topic()));

-- Purge role: only the tables maintenance is allowed to clean.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'core_cron') then
    create role core_cron nologin;
  end if;
end
$$;
grant core_cron to postgres;
grant usage on schema public to core_cron;
grant select, delete on public.event_outbox, public.invitations, public.rate_limit_counters,
      public.devices, public.maintenance_runs to core_cron;

-- core_cron can only see the rows it purges (RLS is default-deny otherwise).
create policy core_cron_purge on public.event_outbox
  for all to core_cron using (true) with check (true);
create policy core_cron_purge on public.invitations
  for all to core_cron using (true) with check (true);
create policy core_cron_purge on public.rate_limit_counters
  for all to core_cron using (true) with check (true);
create policy core_cron_purge on public.devices
  for all to core_cron using (true) with check (true);
create policy core_cron_purge on public.maintenance_runs
  for all to core_cron using (true) with check (true);
