-- Sprint-05 task-01: instance configuration (categories + settings)
-- ADRs: 0004, 0008. Spec: docs/superpowers/specs/2026-10-26-instance-config.md

create table public.settings_categories (
  category_key text primary key,
  label text not null,
  help text,
  icon text,
  sort_order int not null default 0,
  -- 'core' for the Core; 'module:<key>' for module settings (sprint-06).
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
  -- Versioned format "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>" (AES-256-GCM, task-04).
  value_encrypted text,
  is_secret boolean not null default false,
  is_public boolean not null default false,
  mcp_access text not null default 'none'
    check (mcp_access in ('none', 'read', 'write')),
  sort_order int not null default 0,
  updated_by uuid references public.profiles (id),
  -- The api_keys FK is added in sprint-06 when that table exists; today it is a plain uuid.
  updated_by_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_key, key),
  -- At most one actor (human or machine key); migration-seeded rows
  -- have both null. The API requires exactly one on every write (service).
  check ((updated_by is not null)::int + (updated_by_key is not null)::int <= 1),
  -- Secrets: never plaintext (the API always encrypts before writing, so an
  -- unconfigured secret is a row with both null); non-secrets: never encrypted.
  check (is_secret = false or value is null),
  check (is_secret = true or value_encrypted is null)
);

create index settings_category_idx on public.settings (category_key, sort_order);

-- RLS: read access for admins only (a regular user cannot see settings); writes always
-- go through the API (service_role). Metadata not writable via API is enforced here.
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

-- Seed: the instance settings catalog (18 keys, instance-config spec §4).
-- The catalog in code (packages/core/src/settings/catalog.ts) is the source of
-- truth; the db-tests sync check fails if the catalog and this seed drift.
insert into public.settings_categories (category_key, label, help, icon, sort_order, source) values
  ('instance',      'Instance',      'Instance identity and public links.', 'server', 10, 'core'),
  ('localization',  'Localization',  'Languages, timezone and currency.',   'globe',  20, 'core'),
  ('security',      'Security',      'JWT, CORS and other security-relevant values.', 'shield', 30, 'core'),
  ('notifications', 'Notifications', 'Push notification provider (FCM).',   'bell',   40, 'core'),
  ('rate_limit',    'Rate limits',   'Per-identity request limits (per minute).', 'gauge', 50, 'core');

insert into public.settings (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order) values
  ('instance', 'instance.name', 'Instance name', 'Public name of this 027Apps instance.', '"027Apps"', false, true, 'read', 10),
  ('instance', 'instance.public_url', 'Public URL', 'https origin used for invitation links and deep links.', null, false, true, 'none', 20),
  ('localization', 'localization.default_locale', 'Default locale', 'Locale for users without a preference.', '"en"', false, true, 'read', 10),
  ('localization', 'localization.timezone', 'Timezone', 'IANA timezone for dates shown by the instance.', '"UTC"', false, true, 'read', 20),
  ('localization', 'localization.default_currency', 'Default currency', 'ISO 4217 code, must exist and be enabled.', '"EUR"', false, true, 'read', 30),
  ('localization', 'localization.enabled_locales', 'Enabled locales', 'Subset of the 9 supported locales; en cannot be removed.', '["en"]', false, true, 'read', 40),
  ('security', 'security.jwt_expiry', 'JWT expiry (s)', 'Supabase access token lifetime, reflected (read-only).', '900', false, false, 'none', 10),
  ('security', 'security.cors_allowlist', 'CORS allowlist', 'Origins allowed by the API door (max 20, no wildcard, no paths).', '[]', false, false, 'none', 20),
  ('notifications', 'notifications.push.provider', 'Push provider', 'fcm or none.', '"none"', false, false, 'none', 10),
  ('notifications', 'notifications.push.fcm_project_id', 'FCM project id', 'Firebase project id.', null, false, true, 'read', 20),
  ('notifications', 'notifications.push.fcm_app_id', 'FCM app id', 'Firebase web app id.', null, false, true, 'read', 30),
  ('notifications', 'notifications.push.fcm_api_key', 'FCM API key', 'Firebase web API key (client key, not a legacy server key).', null, false, true, 'read', 40),
  ('notifications', 'notifications.push.fcm_sender_id', 'FCM sender id', 'Firebase sender id.', null, false, true, 'read', 50),
  ('notifications', 'notifications.push.fcm_service_account', 'FCM service account', 'Service account JSON used to sign pushes (secret).', null, true, false, 'none', 60),
  ('rate_limit', 'rate_limit.mobile_per_min', 'Mobile per minute', 'Requests per minute from the mobile app.', '120', false, false, 'none', 10),
  ('rate_limit', 'rate_limit.api_key_per_min', 'API key per minute', 'Requests per minute per service key.', '30', false, false, 'none', 20),
  ('rate_limit', 'rate_limit.write_per_min', 'Write per minute', 'Write requests per minute.', '10', false, false, 'none', 30),
  ('rate_limit', 'rate_limit.public_per_min', 'Public per minute', 'Requests per minute for public doors.', '30', false, false, 'none', 40);
