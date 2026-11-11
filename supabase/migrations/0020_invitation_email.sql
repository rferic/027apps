-- Sprint-14 task-03: invitation email (locale + delivery state).
-- Spec: docs/superpowers/specs/2026-11-10-invitation-email-design.md §5.
--
-- `locale` is fixed when the invitation is created so a resend never changes
-- the language under the invitee. The email columns record the last attempt;
-- `email_error` stores a short code, never the provider body.

alter table public.invitations
  add column locale text,
  add column email_sent_at timestamptz,
  add column email_failed_at timestamptz,
  add column email_error text;

-- Existing invitations inherit the instance default when it is a supported
-- locale; anything else falls back to English.
update public.invitations i
set locale = case
  when (
    select s.value #>> '{}'
    from public.settings s
    where s.key = 'localization.default_locale'
  ) in ('en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu')
  then (
    select s.value #>> '{}'
    from public.settings s
    where s.key = 'localization.default_locale'
  )
  else 'en'
end
where i.locale is null;

alter table public.invitations
  alter column locale set default 'en',
  alter column locale set not null,
  add constraint invitations_locale_check
    check (locale in ('en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu')),
  add constraint invitations_email_error_check
    check (email_error is null or (length(email_error) between 1 and 64));
