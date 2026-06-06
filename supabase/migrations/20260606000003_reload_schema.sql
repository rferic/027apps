-- Helper functions to access app_settings without PostgREST schema cache dependency
-- These bypass the REST API and use direct SQL

create or replace function public.get_app_setting(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
  declare v_value jsonb;
begin
  select value into v_value from public.app_settings where key = p_key;
  return v_value;
end;
$$;

create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key)
  do update set value = p_value, updated_at = now();
end;
$$;

create or replace function public.delete_app_setting(p_key text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  delete from public.app_settings where key = p_key;
end;
$$;

-- Force PostgREST schema reload
notify pgrst, 'reload schema';
