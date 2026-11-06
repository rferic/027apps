-- Sprint-06 task-05 audit: the catalogue must not reveal private or disabled
-- modules to regular users (the API already filters; this aligns RLS).
drop policy if exists module_registry_select on public.module_registry;
create policy module_registry_select on public.module_registry
  for select to authenticated
  using (
    public.core_is_admin()
    or (
      state = 'active'
      and (
        is_public = true
        or exists (
          select 1 from public.user_modules u
           where u.module_key = key
             and u.user_id = auth.uid()
             and u.revoked_at is null
        )
      )
    )
  );
