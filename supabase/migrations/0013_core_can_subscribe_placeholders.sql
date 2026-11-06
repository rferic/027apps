-- Incremental migration after 0012: replace core_can_subscribe so it accepts any
-- declared `{placeholder}` in module channel patterns, not only `{id}`.
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
       and topic ~ ('^' || regexp_replace(c.pattern, '\{[a-z_]+\}', '[0-9a-f-]{36}', 'g') || '$')
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
      return false;
    end;
  end loop;

  return false;
end;
$$;

revoke execute on function public.core_can_subscribe(text) from public, anon;
grant execute on function public.core_can_subscribe(text) to authenticated;
