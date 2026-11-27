# API — Tareas

All routes live under `/api/v1/todo` and answer with the Core envelope. The table
below is the contract; implementation lands in the API task.

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
