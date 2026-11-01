-- Sprint-05 task-01: configuración de instancia (categories + settings)
-- ADRs: 0004, 0008. Spec: docs/superpowers/specs/2026-10-26-instance-config.md

create table public.settings_categories (
  category_key text primary key,
  label text not null,
  help text,
  icon text,
  sort_order int not null default 0,
  -- 'core' para el Core; 'module:<key>' para settings de módulo (sprint-06).
  source text not null default 'core'
    check (source = 'core' or source like 'module:%'),
  created_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references public.settings_categories (category_key) on delete cascade,
  key text not null,
  label text not null,
  help text,
  value jsonb,
  -- Formato versionado "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>" (AES-256-GCM, task-04).
  value_encrypted text,
  is_secret boolean not null default false,
  is_public boolean not null default false,
  mcp_access text not null default 'none'
    check (mcp_access in ('none', 'read', 'write')),
  sort_order int not null default 0,
  updated_by uuid references public.profiles (id),
  -- FK a api_keys se añade en sprint-06 cuando exista esa tabla; hoy es uuid puro.
  updated_by_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_key, key),
  -- A lo sumo un actor (humano o clave de máquina); las filas sembradas por migración
  -- tienen ambos a null. La API exige exactamente uno en cada escritura (service).
  check ((updated_by is not null)::int + (updated_by_key is not null)::int <= 1),
  -- Secretos: solo value_encrypted; no secretos: solo value.
  check (is_secret = false or (value is null and value_encrypted is not null)),
  check (is_secret = true or value_encrypted is null)
);

create index settings_category_idx on public.settings (category_key, sort_order);

-- RLS: lectura solo para admins (un usuario normal no ve settings); la escritura pasa
-- siempre por la API (service_role). Metadatos no escribibles por API se garantizan aquí.
alter table public.settings_categories enable row level security;
alter table public.settings enable row level security;

grant select on public.settings_categories to anon, authenticated;
grant select on public.settings to anon, authenticated;
grant all on public.settings_categories to service_role;
grant all on public.settings to service_role;

create policy "settings_categories_select_admin" on public.settings_categories
  for select to authenticated using (core_is_admin());

create policy "settings_select_admin" on public.settings
  for select to authenticated using (core_is_admin());
