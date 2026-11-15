-- Demo data capability (D21): off by default, and the API refuses it in
-- production unless ALLOW_DEMO_DATA=true is set on the instance.
insert into public.settings
  (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
values
  ('instance', 'demo.enabled', 'Demo data',
   'Allow installing sample members, categories and module data. Refused in production unless ALLOW_DEMO_DATA=true.',
   'false', false, false, 'none', 30)
on conflict (category_key, key) do nothing;
