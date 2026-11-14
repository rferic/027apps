# OweNo en Android — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** cerrar la tarea 07: miembros e invitaciones en la app, importador de Splitwise, realtime sin push, capturas reales y landing `available`.

**Architecture:** el dominio y la API de OweNo ganan el ciclo de vida de miembros y un directorio acotado para el importador; la app los consume con su `ApiClient` y pantallas Compose, sin duplicar reglas de dinero. La revisión final la hace un agente QA + diseñador distinto del implementador.

**Spec:** `docs/superpowers/specs/2026-11-13-owe-no.md`, `docs/tasks/sprint-15-app-y-finanzas/task-07.md`, mockup `docs/mockups/owe-no/` (F1).

## Restricciones

- Una moneda por grupo; importes enteros; fechas de calendario; locale del perfil.
- Solo el creador importa y gestiona miembros; `invited` no ve movimientos.
- Salir/echar/bloquear exigen saldo cero (un miembro sin estado activo no puede pagar).
- Push bloqueado por Firebase: la app compila y funciona sin él; no se inventan credenciales.
- Nada se anuncia sin APK compilado, capturas y revisión QA + diseñador.

## Tasks

1. **Dominio de miembros**: `leaveGroup`, `removeMember`, `blockMember`, `unblockMember`; `addMember` rechaza bloqueados. Tests de saldo, último miembro y permisos.
   - `removeMember`/`blockMember` ganan `mode: "settle" | "ghost"` (D29). `ghost` desvincula `user_id` y conserva la fila ficticia con su saldo; `settle` exige registrar antes las transferencias del miembro. La API recibe `mode` y la app pregunta solo cuando el saldo no es cero.
2. **API de miembros**: `POST /groups/{id}/leave`, `DELETE /groups/{id}/members/{memberId}`, `POST|DELETE /groups/{id}/members/{memberId}/block`; OpenAPI y docs.
3. **Directorio del importador**: `GET /groups/{id}/imports/identities` (creador) con usuarios activos fuera del grupo; límite 200; nota de privacidad.
4. **Capa de datos Android**: DTOs y métodos para miembros, salir, echar, bloquear, invitaciones, preview/commit de importación e identidades.
5. **Pantallas de miembros** (tanda 2): invitaciones pendientes, invitar por usuario, echar, bloquear, salir; estados de error y carga.
6. **Importador** (tanda 3): elegir CSV por grupo, preview, mapeo de identidades (preguntar por cada nombre, con coincidencias exactas/similares y ficticio; D28), confirmación de duplicados y resultado. La cuenta entra solo al confirmar la identidad, con aviso de que verá el histórico.
7. **Realtime** (sin push): topic del grupo, reconexión con backoff y resync al volver del segundo plano.
8. **Cierre**: capturas con datos de demo, landing `available`, APK, revisión independiente QA + diseñador y corrección de hallazgos.

## Interfaces

- Dominio: `leaveGroup(deps, userId, groupId)`, `removeMember(deps, actorId, groupId, memberId)`, `blockMember(deps, actorId, groupId, memberId)`, `unblockMember`.
- API: códigos `204` en acciones; `409` con `member_has_balance`, `last_member`, `member_blocked`.
- Importador: `mapping: Record<name, memberId>`; `identities` devuelve `{ identities: [{ id, display_name }] }`.
- App: `OweMemberDto`, `OweImportPreviewDto`, `OweImportResultDto`; métodos `oweLeaveGroup`, `oweRemoveMember`, `oweBlockMember`, `oweImportPreview`, `oweImportCommit`.
