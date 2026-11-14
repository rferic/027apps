# OweNo

Shared expenses for the household: groups, members, movements (expenses and
settlements), balances and the Splitwise importer. Available in the app and,
for administration, in the panel.

## Requirements

- The Core's identity helper (`public.core_current_user_id()`), installed by
  the platform.
- Nothing else: the module owns its schema (`module_owe_no`) and never reads
  another module's tables.

## Install and activate

Install it from the panel (`Modules → Install`), then activate it. Installing
runs the DDL and seeds the two settings; activation makes it visible to the
users it is granted to. Uninstalling reverses the migrations and drops the
schema.

## Settlement

`owe_no.settlement_exact_limit` decides when the plan is the exact minimum. The
search is exponential, so it also has a node budget: a group inside the limit
that exhausts it gets the deterministic pairwise plan and says so, exactly like
a group above the limit.

## Capabilities

- Panel pages: overview, groups and imports, for admins.
- Settings: `owe_no.default_currency` and `owe_no.settlement_exact_limit`.
- Dashboard widgets: `owe-no.summary` (app) and `owe-no.metric` (panel).
- Events: movements created/updated/deleted and a member linked to an account.
- Demo hooks: `seed_demo` and `clear_demo`.
