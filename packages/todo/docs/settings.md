# Settings — Tareas

| Key | Type | Default | Meaning |
|---|---|---|---|
| `default_power` | int (1–5) | `1` | Value a new task gets when its group uses power. |
| `request_ttl_hours` | int (1–168) | `24` | How long a request to take a task stays open. |

Neither is secret. The per-group switch and period are group data
(`todo_groups.power_enabled` and `power_period`), not instance settings.
