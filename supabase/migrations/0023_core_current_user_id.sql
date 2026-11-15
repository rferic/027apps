-- Identity helper for module RLS policies.
--
-- Module DDL runs as `module_installer` and may not reference the `auth`
-- schema (`assertSafeModuleSql`), nor create `security definer` functions. A
-- module that owns rows per user still needs the caller identity in its
-- policies, so the Core exposes this single, audited function and the guard
-- allowlists exactly `public.core_current_user_id()`.
--
-- `security invoker` on purpose: it only reads the request claims, it does not
-- need elevated privileges, and it cannot be turned into a confused deputy.
create or replace function public.core_current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select (
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )
  )::uuid
$$;

comment on function public.core_current_user_id() is
  'Caller user id for module RLS policies; the only public function module DDL may call.';

grant execute on function public.core_current_user_id() to authenticated, service_role;

-- A module may point a column at `profiles(id)` (with `on delete set null`) to
-- model "this row belongs to that user". REFERENCES is the minimum privilege
-- that allows the constraint and does not grant SELECT.
grant references on table public.profiles to module_installer;
