-- Auto-cleanup: delete push tokens for users who no longer exist
delete from public.push_tokens
where user_id not in (select id from auth.users);

-- Auto-cleanup: delete push tokens older than 90 days without update
delete from public.push_tokens
where updated_at < now() - interval '90 days';
