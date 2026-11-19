---
id: sprint-18-task-01
titulo: Migración, ajustes y modelo base
area: core + SQL
estado: pendiente
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: crear el modelo del club y el ajuste de niveles.

**Alcance**

- Migración `0037`: `profiles.invited_by`/`invite_level`, `invitations` anónimas y
  `depth`/`source`/`redeemed_by`, `module_registry.delegable`, `invitation_categories`,
  `join_codes`, `invitation_requests`, `invitation_quota_grants`, índices y RLS.
- Semilla del ajuste `invitations.levels` y de la categoría `invitations`; catálogo
  `packages/core/src/settings/catalog.ts` y default.
- Backfill: usuarios existentes a nivel 1; invitaciones existentes a `source = 'admin'`,
  `depth = 1`.

**Aceptación**

- `pnpm --filter db-tests test -- src/rls/invitation-club.test.ts src/settings/catalog.test.ts` en
  verde.
- Las tablas nuevas no tienen grants a `anon`/`authenticated`; `profiles` no gana columnas
  editables por el propietario.
- `supabase db reset` limpio sobre el stack local.

**Plan**: Task 1.
