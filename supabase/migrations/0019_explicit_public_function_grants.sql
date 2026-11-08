-- CLI 3's bootstrap also installs default privileges for the `postgres` role that
-- grant EXECUTE on every new function in `public` to `anon` and `authenticated`.
-- 0001/0012/0013 assume PUBLIC is the only source of EXECUTE: they revoke it
-- from `public` and `anon`, which is enough on CLI 2.108 (CI) but not here, so a
-- `members_fn` created afterwards stayed callable by any signed-in member and
-- the realtime RLS test failed only on the local CLI 3.0.0. Close the default
-- hole so future functions are deny-by-default and each one grants explicitly;
-- the three helpers that exist today are already granted by 0001/0012/0013.

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
