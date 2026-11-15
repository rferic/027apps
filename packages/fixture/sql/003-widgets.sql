-- Dashboard widgets read through a function in the module schema:
-- `(user_id uuid) returns jsonb`. The panel renders `value` natively; `label`
-- and `detail` are optional strings the module owns.
create function widget_metric(uid uuid) returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'value', count(*),
    'label', 'notes',
    'detail', 'owned by you'
  )
  from notes
  where user_id = uid;
$$;
