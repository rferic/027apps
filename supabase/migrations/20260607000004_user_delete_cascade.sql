-- Fix foreign key constraints so user deletion doesn't fail

-- invitations: delete invitations created by the deleted user
alter table public.invitations
  drop constraint invitations_invited_by_fkey,
  add constraint invitations_invited_by_fkey
    foreign key (invited_by) references auth.users(id)
    on delete cascade;

-- invitations: clear accepted_by reference (keep the invitation record)
alter table public.invitations
  drop constraint invitations_accepted_by_fkey,
  add constraint invitations_accepted_by_fkey
    foreign key (accepted_by) references auth.users(id)
    on delete set null;

-- group_members: clear invited_by reference (row itself is cascaded via user_id)
alter table public.group_members
  drop constraint group_members_invited_by_fkey,
  add constraint group_members_invited_by_fkey
    foreign key (invited_by) references auth.users(id)
    on delete set null;
