-- Add GitHub columns to inspiration_requests
alter table if exists inspiration_requests
  add column if not exists github_issue_number integer,
  add column if not exists github_issue_url text;

-- Add github_comment_id to inspiration_comments for dedup
alter table if exists inspiration_comments
  add column if not exists github_comment_id text;

-- Partial unique index for github_comment_id (only when not null)
drop index if exists inspiration_comments_github_comment_id_idx;
create unique index inspiration_comments_github_comment_id_idx on inspiration_comments(github_comment_id) where github_comment_id is not null;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
