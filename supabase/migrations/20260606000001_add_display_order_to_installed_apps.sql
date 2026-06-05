-- Add display_order to installed_apps for drag-and-drop reordering
alter table public.installed_apps add column if not exists display_order integer not null default 0;

-- Set initial order based on installed_at so existing apps have a sensible default
update public.installed_apps
set display_order = sub.rn - 1
from (
  select id, row_number() over (order by installed_at asc) as rn
  from public.installed_apps
) sub
where public.installed_apps.id = sub.id;
