-- Sprint-14 task-05: per-user appearance.
-- Spec: docs/superpowers/specs/2026-11-11-user-appearance-design.md
--
-- The profile is the source of truth for theme and locale; the cookie is only
-- a fast hint for the pre-paint script. A member can update their own theme,
-- exactly like display_name, locale and timezone.

alter table public.profiles
  add column theme text not null default 'system'
  check (theme in ('system', 'light', 'dark'));

grant update (theme) on public.profiles to authenticated;
