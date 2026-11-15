# OweNo settings

## `owe_no.default_currency`

ISO 4217 code a new group starts with. It must exist and be enabled in the
instance's currency catalogue.

## `owe_no.settlement_exact_limit`

How many members a group may have before the settlement plan stops looking for
the exact minimum and falls back to the pairwise suggestion. Integer between 4
and 20, rendered as a slider in the panel. The default is 12.
