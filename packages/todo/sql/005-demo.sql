-- The demo hook used the Core's user-category id as a task category, which is a
-- foreign key into this module's own catalog: on a clean instance that id does
-- not exist and seeding failed. The hook now keeps its category here.
create or replace function seed_demo(ids jsonb) returns jsonb
language plpgsql
as $$
declare
  ana uuid := (ids -> 'users' -> 0 ->> 'id')::uuid;
  luis uuid := (ids -> 'users' -> 1 ->> 'id')::uuid;
  gid uuid;
  category uuid;
  personal uuid;
begin
  if ana is null then
    return jsonb_build_object('groups', 0);
  end if;
  select id into gid from module_todo.todo_groups
   where name = 'Demo family' and kind = 'group' and owner_id = ana
   limit 1;
  if gid is not null then
    return jsonb_build_object('groups', 0);
  end if;

  insert into module_todo.todo_categories (name, emoji, color, sort_order)
  select 'Casa', '📌', 'indigo', 10
   where not exists (select 1 from module_todo.todo_categories where name = 'Casa');
  select id into category from module_todo.todo_categories
   where name = 'Casa'
   order by sort_order, created_at
   limit 1;

  insert into module_todo.todo_groups (name, kind, owner_id, timezone, power_enabled, power_period)
  values ('Demo family', 'group', ana, 'Europe/Madrid', true, 'monthly')
  returning id into gid;

  insert into module_todo.todo_group_members (group_id, user_id, role) values (gid, ana, 'owner');
  if luis is not null then
    insert into module_todo.todo_group_members (group_id, user_id, role) values (gid, luis, 'member');
  end if;

  insert into module_todo.todo_seasons (group_id, number, period, started_on)
  values (gid, 1, 'monthly', current_date);

  insert into module_todo.todo_tasks (group_id, title, notes, category_id, power, assignee_id, created_by)
  values
    (gid, '🛒 Comprar para la semana', 'La lista está en la nevera', category, 2, ana, ana),
    (gid, '🧾 Pagar la comunidad', null, category, 5, null, ana),
    (gid, '💡 Cambiar la bombilla del pasillo', null, null, 1, luis, ana);

  update module_todo.todo_tasks set state = 'done', completed_at = now(), completed_by = luis
   where group_id = gid and title like '%bombilla%';

  if luis is not null then
    insert into module_todo.todo_power_totals (group_id, user_id, season_number, points, tasks_done)
    values (gid, luis, 1, 1, 1);
  end if;

  select id into personal from module_todo.todo_groups where kind = 'personal' and owner_id = ana;
  if personal is null then
    insert into module_todo.todo_groups (name, kind, owner_id, timezone)
    values ('Personal', 'personal', ana, 'Europe/Madrid')
    returning id into personal;
    insert into module_todo.todo_group_members (group_id, user_id, role) values (personal, ana, 'owner');
  end if;

  return jsonb_build_object('groups', 1, 'tasks', 3);
end;
$$;
