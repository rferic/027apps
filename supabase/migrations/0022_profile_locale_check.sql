-- Constrain profile locale to the supported set at the database level.
-- The API validates with zod and the panel sanitises on read, but authenticated
-- clients can reach PostgREST directly; this closes that path.

update public.profiles
   set locale = 'en'
 where locale not in ('en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu');

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu'));
