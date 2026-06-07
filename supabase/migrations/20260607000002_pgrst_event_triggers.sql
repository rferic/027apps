-- Auto-reload PostgREST schema cache on DDL changes
-- Official PostgREST recommendation:
-- https://postgrest.org/en/stable/references/schema_cache.html#automatic-schema-cache-reloading

create or replace function pgrst_ddl_watch() returns event_trigger as $$
declare
  cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
  loop
    if cmd.command_tag in (
      'CREATE SCHEMA', 'ALTER SCHEMA',
      'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE',
      'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE',
      'CREATE VIEW', 'ALTER VIEW',
      'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW',
      'CREATE FUNCTION', 'ALTER FUNCTION',
      'CREATE TRIGGER',
      'CREATE TYPE', 'ALTER TYPE',
      'CREATE RULE',
      'COMMENT'
    )
    and cmd.schema_name is distinct from 'pg_temp'
    then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $$ language plpgsql;

create or replace function pgrst_drop_watch() returns event_trigger as $$
declare
  obj record;
begin
  for obj in select * from pg_event_trigger_dropped_objects()
  loop
    if obj.object_type in (
      'schema', 'table', 'foreign table', 'view',
      'materialized view', 'function', 'trigger',
      'type', 'rule'
    )
    and obj.is_temporary is false
    then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $$ language plpgsql;

drop event trigger if exists pgrst_ddl_watch;
drop event trigger if exists pgrst_drop_watch;

create event trigger pgrst_ddl_watch
  on ddl_command_end
  execute procedure pgrst_ddl_watch();

create event trigger pgrst_drop_watch
  on sql_drop
  execute procedure pgrst_drop_watch();
