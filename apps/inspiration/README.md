# Inspiration

![Inspiration](../apps/inspiration/logo.svg)

**Idea board** for group members — propose improvements, report bugs, request new features, and vote on what matters most.

| Property | Value |
|----------|-------|
| Slug | `inspiration` |
| Primary color | `#F59E0B` (Amber) |
| Version | 1.0.0 |
| Views | Public · Admin · Widget |
| API | ✅ Full CRUD + vote + comments |
| i18n | 6 languages |

## Features

- **6 request types**: Bug, Improvement, New App, App Feature, General Functionality, Other
- **Voting**: Members can support ideas
- **Comments**: Threaded discussions per idea
- **Status workflow**: `pending → reviewing → approved → in_progress → completed`
- **Notifications**: Email alerts on new ideas, comments, and status changes
- **Dashboard widget**: Most supported + recently completed

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/{group}/apps/inspiration` | List ideas (paginated, filterable) |
| POST | `/api/v1/{group}/apps/inspiration` | Create a new idea |
| PUT | `/api/v1/{group}/apps/inspiration/{id}` | Update title/description or status |
| DELETE | `/api/v1/{group}/apps/inspiration/{id}` | Delete an idea (204 No Content) |
| GET | `/api/v1/{group}/apps/inspiration/{id}/comments` | List comments |
| POST | `/api/v1/{group}/apps/inspiration/{id}/comments` | Add a comment |
| POST | `/api/v1/{group}/apps/inspiration/{id}/vote` | Toggle vote |

## Documentation

- [Full docs](https://027apps-eric-rf.vercel.app/en/doc)
- [Interactive API](https://027apps-eric-rf.vercel.app/api-docs)
