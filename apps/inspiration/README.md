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

## GitHub Issues Integration (Sprint 20)

The Inspiration module can sync ideas bidirectionally with GitHub Issues via a GitHub App.

### Setup

1. Go to **Admin → Settings → GitHub**
2. Click **"Connect to GitHub"** — this uses the GitHub App Manifest flow to create an app in your account
3. Follow GitHub's prompts to install the app on a repository
4. After installation, set the **repository** (format: `owner/repo`)
5. Optionally customize the **label mapping** for each idea type
6. Toggle **"Sync ideas to GitHub Issues"** ON

### Default label mapping

| Idea type | GitHub label |
|-----------|-------------|
| Bug | `bug` |
| Improvement | `enhancement` |
| New App | `new app` |
| App Feature | `app feature` |
| General Functionality | `feature` |
| Other | `other` |

Labels can be customized in Admin → Settings → GitHub.

### How it works

Each action in the web app affects the GitHub issue as follows:

| Web action | GitHub repercussion |
|---|---|
| Create idea (sync ON) | Creates a new issue with label matching the idea type |
| Change status to `completed` | Closes issue (reason: completed) |
| Change status to `rejected` | Closes issue (reason: not planned) + label |
| Change status to `duplicate` | Closes issue (reason: not planned) + label + auto-comment |
| Change status to `in_progress` / `reviewing` / etc. | Reopens issue if previously closed |
| Add a comment | Adds comment to the GitHub issue |
| Unlink issue | Removes the association (issue stays open on GitHub) |
| Generate issue | Creates a new issue for an existing idea without one |
| Delete idea (admin) | Closes the associated GitHub issue |

And from GitHub back to the web:

| GitHub event | Web repercussion |
|---|---|
| Issue closed | Idea status updated to `completed` or `rejected` |
| Issue reopened | Idea status updated to `in_progress` |
| New comment on issue | New comment added to the idea (marked "via GitHub") |

### Anti-loop protection

- Comments synced from GitHub are tracked via `github_comment_id` (unique per comment)
- If a webhook delivers a comment that was already synced, it is ignored
- Status changes check if the new state differs from the current one before applying

### Environments

| Environment | Behavior |
|---|---|
| **Local** (`development`) | **Dry-run mode** — API calls are logged but not sent to GitHub |
| **Staging** (`preview`) | Real calls to GitHub — use a test repository |
| **Production** (`production`) | Real calls to GitHub — use the real repository |

### New API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/{group}/apps/inspiration/{id}/github-link` | Generate a GitHub issue for an idea without one |
| POST | `/api/v1/{group}/apps/inspiration/{id}/github-unlink` | Unlink the GitHub issue from an idea |
| POST | `/api/v1/github/webhook` | Webhook receiver (called by GitHub, not by clients) |

### Security

- The GitHub App **private key** is stored encrypted in **Supabase Vault**
- Webhook requests are verified via **HMAC-SHA256** signature
- Only users with **admin role** can configure the GitHub integration
- The installation token is **cached** and rotated every 60 minutes
