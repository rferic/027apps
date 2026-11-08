-- Sprint-06 task-13 (audit M1): API keys are written by the Core only.
--
-- The table used to grant insert/update/delete to `authenticated`, and the
-- `api_keys_write` policy allowed a user to write their own delegated rows. A
-- user JWT could therefore insert a row with an arbitrary `key_hash`, arbitrary
-- `scopes` and even someone else's `user_id`, bypassing the Core's five-key
-- limit and ownership checks. Writes now go through the service pool after the
-- authorization guard; a user JWT keeps SELECT through `api_keys_select`.

drop policy if exists api_keys_write on public.api_keys;
revoke insert, update, delete on public.api_keys from authenticated;
