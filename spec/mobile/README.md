# Behavior scenarios (mobile)

The behaviour of both apps is defined **here**, not in Kotlin or Swift. A rule,
validation, state or text that the user can observe gets a scenario in this
folder in the same PR that implements it; without a scenario it is not a
contract (`docs/flows/mobile.md`, rule 1).

- `docs/ai/parity.md` says **which capability exists on each app**.
- `spec/mobile/<area>.yaml` says **what the app must do**, independent of the
  platform.
- Android covers the scenario with a test; iOS will cover it with Swift Testing
  when its phase starts.

## File format

One file per area. Ids start with a capability from the parity matrix
(`pnpm check:parity` enforces it), so the two documents cannot drift apart.

```yaml
feature: invitations
source: docs/superpowers/specs/2026-11-18-invitation-club-design.md
scenarios:
  - id: invites.redeem.new-account
    given: an anonymous invitation link
    when: the invitee fills name, email and a new password
    then:
      - the account is created with the typed name
      - the invitation is consumed
```

Fields:

- `id` — `<capability>.<behaviour>`, unique across the folder.
- `given` / `when` — the starting state and the action, in plain language.
- `then` — the observable result. One line per assertion; the platform tests
  assert the same lines.
- `android` / `ios` (optional) — the test that covers it, for traceability.

Server-side rules (seat arithmetic, level capture, token hashing) stay in the
Core: a scenario only describes what the app shows or sends, never how the
database works. If a behaviour can be computed by the server, it belongs there
(`docs/flows/mobile.md`, rule 2).
