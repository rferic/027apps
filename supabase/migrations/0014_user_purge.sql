-- Sprint-06 task-11: physical deletion of a member (`DELETE /users/{id}/purge`).
-- The purge nulls the actor references that would otherwise block
-- `delete from auth.users`; history rows survive without an actor, because a
-- purged profile must not be recreated as a synthetic one. The "always exactly
-- one actor" checks relax to "at most one" for that reason.

alter table public.api_keys alter column created_by drop not null;

alter table public.invitations drop constraint invitations_check;
alter table public.invitations add constraint invitations_check
  check (num_nonnulls(created_by, created_by_key) <= 1);

alter table public.user_categories drop constraint user_categories_check;
alter table public.user_categories add constraint user_categories_check
  check (num_nonnulls(created_by, created_by_key) <= 1);

alter table public.user_modules drop constraint user_modules_check;
alter table public.user_modules add constraint user_modules_check
  check (num_nonnulls(granted_by, granted_by_key) <= 1);

alter table public.user_category_modules drop constraint user_category_modules_check;
alter table public.user_category_modules add constraint user_category_modules_check
  check (num_nonnulls(assigned_by, assigned_by_key) <= 1);
