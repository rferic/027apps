-- `instance.logo_url` left the catalog in sprint 06; the row is dead weight and
-- must not survive a restore as if it were configurable.
delete from public.settings where key = 'instance.logo_url';
