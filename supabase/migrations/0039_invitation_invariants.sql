-- Invariants the application already guarantees, enforced by the schema.
--
-- The invitation is either fully named (email and name from the panel) or
-- anonymous (both null, the invitee fills them in at redemption): a half-filled
-- row has no meaning and made the anonymous checks depend on the application
-- alone.
alter table public.invitations
  add constraint invitations_identity_pair
  check ((email is null) = (name is null));

-- A grant's reason follows the same 1..280 rule as a request's reason.
alter table public.invitation_quota_grants
  add constraint invitation_quota_grants_reason_length
  check (reason is null or length(btrim(reason)) between 1 and 280);
