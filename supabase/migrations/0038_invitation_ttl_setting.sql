-- Member invitation link lifetime (hours). 48 h by default, as the sprint 18
-- spec set; an administrator may widen or narrow it in the panel. Invitations
-- already created keep the `expires_at` they were minted with.
insert into public.settings
  (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
values
  ('invitations', 'invitations.member_ttl_hours', 'Member link validity (hours)',
   'How long a member invitation link stays valid before it expires. 48 hours by default. Links already handed out keep the lifetime they were created with.',
   '48'::jsonb, false, false, 'none', 20)
on conflict (category_key, key) do nothing;
