# Demo

Test-only module. It exercises the runtime (schema grants, RLS identity helper, scopes, admin
page and uninstall) and is never installed in production. Nothing here is product code.

## What it exercises

- `1.0.0`: schema grants, the RLS identity helper and the `notes` table.
- `1.1.0`: a scheduled job (`ping`) that writes to `job_log`.
- `1.3.0`: a dashboard widget (`fixture.notes`) reading `widget_metric(uid)`, plus the
  `add_note` app action declared in the manifest.
