## Summary

<!-- What changed and why. Link the task/plan/spec when applicable. -->

## Module contract

- [ ] If I changed the module manifest contract, lifecycle, or creation workflow, I updated
      `docs/ai/module-system.md`, `docs/ai/manifest.schema.json` (if the schema changed), the
      module section in `AGENTS.md`/`CLAUDE.md`, the provider wrappers, and the examples.

## Checks

- [ ] `pnpm lint && pnpm tsc && pnpm test` passed.
- [ ] Affected build passed (`pnpm --filter admin build` and/or Android unit tests) when applicable.
- [ ] Security review completed when the change touches auth, permissions, secrets, or user data.
- [ ] Docs, flows, and task file updated when behavior changed.

## Notes

<!-- Risks, follow-ups, or blocked capabilities. -->
