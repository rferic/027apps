# OweNo events

- `owe_no.movement_created`: a movement was added to a group. Push.
- `owe_no.movement_updated`: a movement was edited. Push.
- `owe_no.movement_deleted`: a movement was soft-deleted. Push.
- `owe_no.member_linked`: an admin linked a fictitious member to a real
  account.

## Realtime channel

`owe-no-group-{id}`: only `active` members of that group can subscribe. The
membership function is `channel_members(topic)`; an invited, removed or left
member is rejected.
