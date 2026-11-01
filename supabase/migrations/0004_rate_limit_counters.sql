-- Sprint-05 task-01: contadores de rate limiting (decisión Z, core-api §4)
-- Upsert atómico desde la puerta: INSERT ... ON CONFLICT DO UPDATE SET count = count + 1.
-- La purga usa el índice por expires_at (sprint-06, job de mantenimiento).

create table public.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  expires_at timestamptz not null,
  primary key (key, window_start)
);

create index rate_limit_counters_expires_idx on public.rate_limit_counters (expires_at);

-- RLS: sin políticas para anon/authenticated (ven 0 filas); el servidor usa service_role,
-- que bypassa RLS. Se concede SELECT para que el fallo sea un resultado vacío y no un
-- "permission denied" (la tabla es interna, pero su existencia no es un secreto).
alter table public.rate_limit_counters enable row level security;

grant select on public.rate_limit_counters to anon, authenticated;
grant all on public.rate_limit_counters to service_role;

-- Tabla interna del servidor: RLS deniega todo a anon y authenticated. Solo service_role
-- (que bypassa RLS) la lee y escribe. Sin grants explícitos (por defecto revocados con
-- auto_expose_new_tables ausente; se revocan de forma explícita en la migración de RLS).
