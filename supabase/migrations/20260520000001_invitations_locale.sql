alter table public.invitations add column if not exists locale text not null default 'es';

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale in ('es', 'en', 'it', 'ca', 'fr', 'de'));
