# To-Do

![To-Do](../apps/todo/logo.svg)

**Task management app** — full-featured task app with categories, priorities, assignments, due dates, and email notifications.

| Property | Value |
|----------|-------|
| Slug | `todo` |
| Primary color | `#4F46E5` (Indigo) |
| Version | 1.0.0 |
| Views | Public · Admin · Widget |
| API | ✅ Full CRUD with pagination and filters |
| i18n | 6 languages |

## Features

- **Public/Private tasks**: Public tasks visible to all group members, private tasks visible only to creator
- **Categories**: Global categories with emoji + color, managed by admins
- **Priorities**: `urgent`, `high`, `medium`, `low` with visual indicators
- **Due dates**: Optional due dates with overdue highlighting (red) and today indicator (amber)
- **Assignment**: Tasks can be assigned to any group member
- **Filters**: Filter by category, priority, and status
- **Email notifications**: Configurable per-user (on assignment, on status change)
- **Dashboard widgets**: "My tasks" and "Group tasks" with "Take" button

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/{group}/apps/todo/items` | List items with pagination + filters |
| POST | `/api/v1/{group}/apps/todo/items` | Create item |
| GET | `/api/v1/{group}/apps/todo/items/{id}` | Get item |
| PUT | `/api/v1/{group}/apps/todo/items/{id}` | Update item |
| DELETE | `/api/v1/{group}/apps/todo/items/{id}` | Delete item (204 No Content) |
| GET | `/api/v1/{group}/apps/todo/categories` | List categories |
| POST | `/api/v1/admin/apps/todo/categories` | Create category (admin) |
| PUT | `/api/v1/admin/apps/todo/categories/{id}` | Update category (admin) |
| DELETE | `/api/v1/admin/apps/todo/categories/{id}` | Delete category (admin) |
| GET | `/api/v1/{group}/apps/todo/widget/my` | My tasks widget |
| GET | `/api/v1/{group}/apps/todo/widget/group` | Group tasks widget |
| GET | `/api/v1/{group}/apps/todo/notification-prefs` | Get notification preferences |
| PUT | `/api/v1/{group}/apps/todo/notification-prefs` | Update notification preferences |

## Documentation

- [Full docs](https://027apps-eric-rf.vercel.app/en/doc)
- [Interactive API](https://027apps-eric-rf.vercel.app/api-docs)
