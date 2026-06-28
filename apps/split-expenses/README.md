# Split Expenses

Track shared expenses within a group. Create expense groups, add members, split bills equally or custom, and settle debts.

## Features

- **Expense Groups** — Create groups (home, trip, etc.) with members and currency
- **Expenses** — Add expenses with amount, description, paid-by, and split among participants
- **Split Types** — Equal split or custom amount per person
- **Transfers** — Record direct payments between members
- **Balances** — Real-time balance calculation showing who owes whom
- **Suggested Settlements** — Optimal debt settlement algorithm (minimizes number of transfers)
- **Stats** — Per-group statistics: total spent, per-person breakdown, category distribution
- **Tags** — Categorize expenses with custom tags
- **Notifications** — Push and email notifications for new expenses and settlements
- **Mobile** — Full mobile app with 5 screens (NativeWind + Expo)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/{groupSlug}/apps/split-expenses` | List groups |
| `POST` | `/{groupSlug}/apps/split-expenses` | Create group |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}` | Get group details |
| `PUT` | `/{groupSlug}/apps/split-expenses/{id}` | Update group |
| `DELETE` | `/{groupSlug}/apps/split-expenses/{id}` | Delete group |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/expenses` | List expenses |
| `POST` | `/{groupSlug}/apps/split-expenses/{id}/expenses` | Create expense |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/expenses/{expenseId}` | Get expense detail |
| `PUT` | `/{groupSlug}/apps/split-expenses/{id}/expenses/{expenseId}` | Update expense |
| `DELETE` | `/{groupSlug}/apps/split-expenses/{id}/expenses/{expenseId}` | Delete expense |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/members` | List members |
| `POST` | `/{groupSlug}/apps/split-expenses/{id}/members` | Add member |
| `DELETE` | `/{groupSlug}/apps/split-expenses/{id}/members/{memberId}` | Remove member |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/balances` | Get balances |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/transfers` | List transfers |
| `POST` | `/{groupSlug}/apps/split-expenses/{id}/transfers` | Create transfer |
| `PUT` | `/{groupSlug}/apps/split-expenses/{id}/transfers/{transferId}` | Update transfer |
| `DELETE` | `/{groupSlug}/apps/split-expenses/{id}/transfers/{transferId}` | Delete transfer |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/tags` | List tags |
| `POST` | `/{groupSlug}/apps/split-expenses/{id}/tags` | Create tag |
| `DELETE` | `/{groupSlug}/apps/split-expenses/{id}/tags/{tagId}` | Delete tag |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/stats` | Get statistics |
| `GET` | `/{groupSlug}/apps/split-expenses/{id}/settlements` | List settlements |
| `POST` | `/{groupSlug}/apps/split-expenses/{id}/settlements` | Create settlement |

## Database

Tables: `split_expense_groups`, `split_expense_members`, `split_expenses`, `split_expense_splits`, `split_expense_tags`, `split_expense_transfers`, `split_expense_settlements`

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/apps/split-expenses` | List all groups (admin) |
| `GET` | `/api/v1/admin/apps/split-expenses/stats` | Global statistics (admin) |
