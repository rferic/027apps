---
id: sprint-core-design-task-01
titulo: Esquema de BD del Core y RLS — spec de datos (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 1 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-core-data-model.md` — el esquema de datos definitivo del Core.

**Alcance**:
- DDL final de `profiles`, `groups`, `group_members`, `invitations`, `participants`, `api_keys`, `device_tokens`, `instance_settings` (+ `audit` de contadores agregados, spec de tokens §6/§7), con columnas, constraints e índices.
- Evolución del borrador de la spec de diseño §8 según: spec de tokens §7 (api_keys `kind: service|delegated`, `scopes text[]`, `expires_at`, `revoked_at`, `last_used_at`; sin `device_tokens` de refresh — sesión Supabase; `audit`), ADR 0008 (delta: `profiles.timezone`; `instance_settings` además de secrets guarda config no sensible en claro), ADR 0006 (RLS sobre `realtime.messages`).
- **RLS por tabla** (scoped por grupo donde aplique) y el **contrato de la suite de aislamiento** (testing strategy D2: SQL por tabla + script de dos grupos; un miembro del grupo A nunca lee/escribe del B).

**Decisiones a fijar en conversación de diseño**: forma exacta de cada tabla (incl. índices para los listados del Core), qué va cifrado vs en claro en `instance_settings`, políticas RLS por tabla y su nomenclatura, formato del contrato de tests de aislamiento.

**Criterios de aceptación**: el esquema cubre las 8 tablas + `audit` según las specs de base; cada tabla declara su RLS (o justifica por qué no aplica); la suite de aislamiento queda definida como parte del DoD de toda tabla nueva (testing §8); coherente con ADR 0004 (datos solo vía casos de uso / API), ADR 0008 (fechas/moneda) y ADR 0007 (sin fuga de internos).

**Referencias**: spec diseño §8 (`2026-10-24-027apps-design.md`), spec tokens §7 (`2026-10-25-token-model.md`), ADR 0008, testing strategy D2/§8, ADR 0006 (RLS realtime).