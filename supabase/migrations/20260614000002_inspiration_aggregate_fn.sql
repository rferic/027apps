-- Function to list inspiration requests sorted by vote/comment counts
-- Sprint 26: Performance optimization (avoids fetching all data to app layer)

create or replace function get_inspiration_requests_aggregate(
  sort_type text,
  statuses text[] default '{}',
  types text[] default '{}',
  search text default null,
  app_slug text default null,
  my_user_id text default null,
  limit_val int default 20,
  offset_val int default 0
) returns json
language plpgsql
as $$
declare
  result json;
  total_count int;
begin
  -- Count total matching rows
  select count(*) into total_count
  from inspiration_requests ir
  where
    (cardinality(statuses) = 0 or ir.status = any(statuses))
    and (cardinality(types) = 0 or ir.type = any(types))
    and (app_slug is null or ir.app_slug = app_slug)
    and (search is null or ir.title ilike '%' || search || '%' or ir.description ilike '%' || search || '%')
    and (my_user_id is null or ir.user_id = my_user_id::uuid);

  -- Fetch page with counts
  select json_build_object(
    'data', coalesce(json_agg(sub), '[]'::json),
    'total', total_count
  ) into result
  from (
    select
      ir.*,
      (select count(*) from inspiration_votes iv where iv.request_id = ir.id) as vote_count,
      (select count(*) from inspiration_comments ic where ic.request_id = ir.id) as comment_count
    from inspiration_requests ir
    where
      (cardinality(statuses) = 0 or ir.status = any(statuses))
      and (cardinality(types) = 0 or ir.type = any(types))
      and (app_slug is null or ir.app_slug = app_slug)
      and (search is null or ir.title ilike '%' || search || '%' or ir.description ilike '%' || search || '%')
      and (my_user_id is null or ir.user_id = my_user_id::uuid)
    order by
      case when sort_type = 'most_supported' then (select count(*) from inspiration_votes iv where iv.request_id = ir.id) end desc nulls last,
      case when sort_type = 'most_commented' then (select count(*) from inspiration_comments ic where ic.request_id = ir.id) end desc nulls last,
      ir.created_at desc
    limit limit_val
    offset offset_val
  ) sub;

  return result;
end;
$$;
