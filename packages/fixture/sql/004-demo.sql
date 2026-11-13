-- Demo hooks (contract `demo`): the Core passes the dataset ids and expects a
-- jsonb with counts. Seeding is idempotent; clearing removes exactly what this
-- module added.
create function seed_demo(ids jsonb) returns jsonb
language plpgsql
as $$
declare
  owner uuid := (ids -> 'users' -> 0 ->> 'id')::uuid;
  created int;
begin
  insert into notes (user_id, body)
  select owner, 'Demo note'
  where owner is not null
    and not exists (
      select 1 from notes where user_id = owner and body = 'Demo note'
    );
  get diagnostics created = row_count;
  return jsonb_build_object('notes', created);
end;
$$;

create function clear_demo() returns jsonb
language plpgsql
as $$
declare
  removed int;
begin
  delete from notes where body = 'Demo note';
  get diagnostics removed = row_count;
  return jsonb_build_object('notes', removed);
end;
$$;
