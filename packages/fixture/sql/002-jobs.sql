create table job_log (
  id bigserial primary key,
  ran_at timestamptz not null default now()
);

create function job_ping() returns void
language sql
as $$
  insert into job_log default values;
$$;
