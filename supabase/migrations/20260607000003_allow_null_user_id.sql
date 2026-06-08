-- Allow null user_id in inspiration_comments (GitHub-synced comments have no web user)
alter table if exists inspiration_comments
  alter column user_id drop not null;
