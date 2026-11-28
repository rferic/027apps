# API — NotNow

All routes live under `/api/v1/todo` and answer with the Core envelope. Every
route is also published in the instance's OpenAPI document
(`docs/api/openapi.json`, operations tagged `todo`).

| Method | Path | Scope |
|---|---|---|
| `GET` | `/groups` | `groups:read` |
| `POST` | `/groups` | `groups:write` |
| `GET` | `/groups/{id}` | `groups:read` |
| `PATCH` | `/groups/{id}` | `groups:write` |
| `DELETE` | `/groups/{id}` | `groups:write` |
| `GET` | `/groups/{id}/members` | `groups:read` |
| `POST` | `/groups/{id}/members` | `groups:write` |
| `DELETE` | `/groups/{id}/members/{userId}` | `groups:write` |
| `GET` | `/groups/{id}/tasks` | `tasks:read` |
| `POST` | `/groups/{id}/tasks` | `tasks:write` |
| `GET` | `/tasks/{id}` | `tasks:read` |
| `PATCH` | `/tasks/{id}` | `tasks:write` |
| `DELETE` | `/tasks/{id}` | `tasks:write` |
| `POST` | `/tasks/{id}/claim` | `tasks:write` |
| `POST` | `/tasks/{id}/release` | `tasks:write` |
| `POST` | `/tasks/{id}/complete` | `tasks:write` |
| `POST` | `/tasks/{id}/reopen` | `tasks:write` |
| `POST` | `/tasks/{id}/requests` | `tasks:write` |
| `GET` | `/requests` | `tasks:read` |
| `POST` | `/requests/{id}/accept` | `tasks:write` |
| `POST` | `/requests/{id}/deny` | `tasks:write` |
| `GET` | `/groups/{id}/power` | `power:read` |
| `POST` | `/groups/{id}/season/close` | `groups:write` |
| `GET` | `/groups/{id}/seasons` | `power:read` |
| `GET` | `/groups/{id}/seasons/{number}` | `power:read` |
| `GET` | `/categories` | `tasks:read` |

A task is pending or done, holds one assignee or none, and the holder is the only
one who edits and completes it. Requests expire after 24 hours.

## Shapes worth knowing

- `GET /tasks/{id}` answers `{ task, occurrences }`: the periods the task went
  through, newest first (`done`/`missed`, when and by whom).
- `GET /requests?direction=incoming|outgoing` answers rows that name the task,
  its group and who asks (`taskTitle`, `groupName`, `requesterName`), so a client
  renders the inbox without extra reads. `incoming` never includes a request the
  caller made themselves.
- `GET / (group list)` includes `memberCount` and `pendingCount`.
- `GET /groups/{id}` answers `{ group, members }`.

## Idempotency

`POST /groups/{id}/tasks`, `POST /tasks/{id}/complete` and
`POST /tasks/{id}/requests` **require** an `Idempotency-Key` header (8 to 120
characters). A retry with the same key and the same user answers the stored
result and changes nothing; reusing a key on a different endpoint is a
`validation_failed`. A missing header is refused before any work happens, and a
key is kept for a day: older rows are deleted on the next write.

## Errors and limits

Domain codes: `not_found`, `forbidden`, `already_assigned`, `task_done`, `task_pending`,
`request_exists`, `request_expired`, `not_assignee`, `season_closed`, `power_disabled`,
`personal_group`, `last_owner`. Reads allow 120 requests a minute per user, writes 30; creating a
group allows 10 an hour, asking for a task 20, and closing a season 5. `reopen` and
deleting a group are capped at 10/min.
