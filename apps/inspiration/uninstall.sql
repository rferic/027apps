-- Drop tables (CASCADE handles foreign key references)
drop table if exists inspiration_comments cascade;
drop table if exists inspiration_votes cascade;
drop table if exists inspiration_requests cascade;

-- Drop enum types
drop type if exists inspiration_status;
drop type if exists inspiration_type;
