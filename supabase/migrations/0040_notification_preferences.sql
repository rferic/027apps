-- Notification preferences per device (sprint 17, task 02).
--
-- The master switch lives on the device: turning it off must not close the
-- session or unregister the device, so its choices survive turning it back on.
-- Each muted notification kind is a row, so the default is "everything on" and
-- nothing has to be seeded.

alter table public.devices
  add column push_enabled boolean not null default true;

create table public.device_notification_mutes (
  device_id uuid not null references public.devices (id) on delete cascade,
  kind text not null check (length(kind) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (device_id, kind)
);

alter table public.device_notification_mutes enable row level security;
grant select, insert, delete on public.device_notification_mutes to authenticated;

-- The owner of the device is the only one who reads or changes its mutes; the
-- table is personal, unlike `devices`, where an admin may list and revoke.
create policy device_notification_mutes_owner on public.device_notification_mutes
  for all to authenticated
  using (
    exists (
      select 1 from public.devices d
       where d.id = device_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.devices d
       where d.id = device_id and d.user_id = auth.uid()
    )
  );
