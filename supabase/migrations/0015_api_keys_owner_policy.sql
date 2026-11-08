-- Sprint-06 task-13: API-key ownership policy.
-- Delegated keys are visible to their owner and to a super_admin only. The
-- authorization guard no longer treats an admin as a key manager, so the RLS
-- read policy must not give it broader visibility than the guard does.

drop policy if exists api_keys_select on public.api_keys;

create policy api_keys_select on public.api_keys
  for select to authenticated
  using (
    public.core_is_super_admin()
    or user_id = auth.uid()
  );

-- `api_keys_write` is unchanged: nobody but a super_admin or the owner of a
-- delegated key can write, and creating through the API goes through the
-- service pool after the guard's ownership checks.
