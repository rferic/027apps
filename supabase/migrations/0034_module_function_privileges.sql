-- 0034 — two corrections to what 0033 left behind.
--
-- 1. `core_can_subscribe` lost the placeholder fix from 0013: it went back to
--    `replace(pattern, '{id}', …)`, so a channel declaring any other hole (for
--    example `{group_id}`) passed manifest validation but no client could ever
--    subscribe. Back to the regexp that rewrites every placeholder.
-- 2. Functions created in a module schema are executable by PUBLIC by default.
--    Granting `usage` to `authenticated` therefore exposed `seed_demo`,
--    `clear_demo`, `channel_members` and the widget helpers to any signed-in
--    user. Only the RLS helpers a policy calls (`is_*`) stay callable by them;
--    everything else is for `service_role` and the owner.

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
    select c.members_fn, c.pattern, c.module_key
      from public.module_channels c
      join public.module_registry m on m.key = c.module_key
     where m.state = 'active'
       and topic ~ ('^' || regexp_replace(c.pattern, '\{[a-z_]+\}', '[0-9a-f-]{36}', 'g') || '$')
  loop
    begin
      execute format(
        'select exists (select 1 from %I.%I($1) as t(member) where t.member = $2)',
        'module_' || replace(channel.module_key, '-', '_'),
        channel.members_fn
      ) into allowed using topic, uid;
      if coalesce(allowed, false) then
        return true;
      end if;
    exception when others then
      -- Fall through to the public helper; a broken function never grants.
      null;
    end;

    begin
      execute format(
        'select exists (select 1 from public.%I($1) as t(member) where t.member = $2)',
        channel.members_fn
      ) into allowed using topic, uid;
      if coalesce(allowed, false) then
        return true;
      end if;
    exception when others then
      return false;
    end;
  end loop;

  return false;
end;
$$;

revoke execute on function public.core_can_subscribe(text) from public, anon;
grant execute on function public.core_can_subscribe(text) to authenticated;

-- Modules installed before this migration keep the wide-open default; close it
-- the same way the installer does from now on.
do $$
declare
  s text;
  fn record;
begin
  for s in
    select nspname from pg_namespace where nspname ~ '^module_[a-z0-9_]+$'
  loop
    execute format('revoke execute on all functions in schema %I from public, anon, authenticated', s);
    execute format('grant execute on all functions in schema %I to service_role', s);
    execute format(
      'alter default privileges for role module_installer in schema %I
         revoke execute on functions from public, anon, authenticated', s);
    execute format(
      'alter default privileges for role module_installer in schema %I
         grant execute on functions to service_role', s);
    -- A policy runs as the caller: the membership helpers must stay callable.
    for fn in
      select p.proname, pg_get_function_identity_arguments(p.oid) as args
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = s
         and p.proname like 'is\_%'
    loop
      execute format('grant execute on function %I.%I(%s) to authenticated', s, fn.proname, fn.args);
    end loop;
  end loop;
end
$$;
