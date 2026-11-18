-- 0035 — role and original duration of an invitation.
--
-- `role` is the role of the profile created when the invitation is redeemed
-- (never `super_admin`; the service validates it, the column only accepts the
-- two values). `expires_in_days` remembers the duration the invitation was
-- created with so a renewal reuses it instead of resetting to 7 days.
--
-- Existing rows get the real difference between `expires_at` and `created_at`,
-- rounded up and clamped to the same 1..365 range the API accepts. The
-- migration is additive: the previous admin keeps reading `invitations` without
-- these columns.

alter table public.invitations
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

alter table public.invitations
  add column expires_in_days integer;

update public.invitations
   set expires_in_days = greatest(
     1,
     least(365, ceil(extract(epoch from (expires_at - created_at)) / 86400.0)::int)
   )
 where expires_in_days is null;

alter table public.invitations
  alter column expires_in_days set not null,
  alter column expires_in_days set default 7,
  add constraint invitations_expires_in_days_check
    check (expires_in_days between 1 and 365);

comment on column public.invitations.role is
  'Role of the profile created on redemption: user or admin (never super_admin).';
comment on column public.invitations.expires_in_days is
  'Duration the invitation was created with; a renewal reuses it.';
