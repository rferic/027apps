# OweNo API

The module endpoints live under `/api/v1/owe-no` and require the scopes this
module declares. Every read is filtered by membership: an `invited` member sees
the group without amounts, an `active` member reads and writes, and a member
who left or was removed sees nothing.

## Scopes

- `expenses:read`: list groups, movements and balances.
- `expenses:read_write`: create, edit and delete a movement; create a group;
  invite, remove and block members.
- `balances:read`: read the settlement plan of a group.

## Endpoints

- `GET /groups`, `POST /groups`, `GET /groups/{id}`, `PATCH /groups/{id}`.
- `GET /groups/{id}/members`, `POST /groups/{id}/members`,
  `DELETE /groups/{id}/members/{memberId}`, `POST /groups/{id}/blocks`.
- `GET /groups/{id}/movements`, `POST /groups/{id}/movements`,
  `PATCH /groups/{id}/movements/{movementId}`,
  `DELETE /groups/{id}/movements/{movementId}`.
- `GET /groups/{id}/balances`, `GET /groups/{id}/settlement`.
- `GET /groups/{id}/categories`, `POST /groups/{id}/categories`.
- `POST /groups/{id}/imports/preview`, `POST /groups/{id}/imports`.

Amounts are integer minor units (`amount_minor`) with an ISO 4217 currency; a
settlement has exactly one share (the receiver) and its kind is explicit.
