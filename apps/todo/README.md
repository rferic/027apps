# To-Do

![To-Do](../apps/todo/logo.svg)

**Simple task list** — create, complete, and remove to-do items.

| Property | Value |
|----------|-------|
| Slug | `todo` |
| Primary color | `#4F46E5` (Indigo) |
| Version | 1.0.0 |
| Views | Public · Admin · Widget · Native (mobile) |
| API | ✅ Full CRUD |
| i18n | 6 languages |

## Features

- **Create tasks**: Add tasks with a title
- **Complete tasks**: Mark tasks as done with a single click
- **Per-user limits**: Admins can set max items per user (default 50, configurable 1–1000)
- **Visibility**: Tasks can be public (all members) or private (just the owner)
- **Dashboard widget**: Pending and completed counts

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/{group}/apps/todo` | List todo items |
| POST | `/api/v1/{group}/apps/todo` | Create a todo item |
| PUT | `/api/v1/{group}/apps/todo/{id}` | Update title or completed status |
| DELETE | `/api/v1/{group}/apps/todo/{id}` | Delete a todo item (204 No Content) |

## Configuration

| Key | Type | Default | Min | Max |
|-----|------|---------|-----|-----|
| `max_items` | number | 50 | 1 | 1000 |

## Documentation

- [Full docs](https://027apps-eric-rf.vercel.app/en/doc)
- [Interactive API](https://027apps-eric-rf.vercel.app/api-docs)
