-- Supabase's bootstrap gives `anon` and `authenticated` ALL privileges on every
-- table in `public` through default privileges. That silently defeats the
-- column-level grant on `profiles` (a member could write their own `role` and
-- `deactivated_at`) and hands `anon` DML it must never have, so the effective
-- policy depended on the CLI version that provisioned the database. Revoke the
-- blanket grants and re-create exactly the matrix the earlier migrations
-- intend, so the schema is deterministic whatever provisioned it.
--
-- Functions are out of scope: 0001/0013 already revoke EXECUTE on the helpers
-- from `public` and `anon`.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Anonymous callers only read the public catalogue.
grant select on public.profiles,
                public.settings_categories,
                public.settings,
                public.currencies,
                public.rate_limit_counters,
                public.translations
  to anon;

-- Signed-in members read the catalogue and the tables the panel lists.
grant select on public.profiles,
                public.settings_categories,
                public.settings,
                public.currencies,
                public.rate_limit_counters,
                public.translations,
                public.user_categories,
                public.user_category_members,
                public.user_modules,
                public.user_category_modules,
                public.invitations,
                public.invitation_modules,
                public.api_keys,
                public.devices,
                public.module_registry,
                public.module_migrations,
                public.module_channels,
                public.event_outbox,
                public.maintenance_runs
  to authenticated;

-- ...and write only the tables the panel owns. `api_keys` is read-only here:
-- every write goes through the Core (0016).
grant insert, update, delete on public.user_categories,
                                public.user_category_members,
                                public.user_modules,
                                public.user_category_modules,
                                public.invitations,
                                public.invitation_modules,
                                public.devices
  to authenticated;

-- Currencies are edited from settings, but a profile may only change three
-- columns: `role` and `deactivated_at` stay out of reach.
grant update on public.currencies to authenticated;
grant update (display_name, locale, timezone) on public.profiles to authenticated;
