# Events — NotNow

One channel, `todo-group-{id}`, resolved by `channel_members(topic text)`.

| Event | Target | Notifies |
|---|---|---|
| `todo.task_created` | channel | group, when the task is created free |
| `todo.task_created_assigned` | user | the assignee, when created with a holder |
| `todo.task_assigned` | user | the new assignee |
| `todo.task_released` | channel | group |
| `todo.task_completed` | channel | group, always |
| `todo.task_overdue` | channel | group, when a free task passes its date |
| `todo.task_overdue_assigned` | user | the holder, same case |
| `todo.task_missed_period` | channel | group, when a period closes with a free task undone |
| `todo.task_missed_period_assigned` | user | the holder, same case |
| `todo.request_created` | user | current holder |
| `todo.request_resolved` | user | requester |
| `todo.season_closed` | channel | group |

The actor never receives their own notification: the Core filters the caller out
before sending. Each event maps to one of four notification kinds the user can
silence per device (`todo.task`, `todo.overdue`, `todo.request`, `todo.season`).
