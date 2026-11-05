-- Instance logo (optional). Public so the login screen and the wizard can show
-- it before there is a session; empty means "use the default 027Apps mark".
insert into public.settings (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
values (
  'instance',
  'instance.logo_url',
  'Logo URL',
  'Optional https URL of the instance logo (defaults to the 027Apps mark).',
  null,
  false,
  true,
  'read',
  15
)
on conflict (category_key, key) do nothing;
