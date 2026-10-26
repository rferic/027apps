---
id: sprint-core-design-task-08
titulo: Observabilidad — logging, Sentry, guía de depuración (definición)
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 8 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-observabilidad.md` — cómo se observa la instancia (logs, errores, correlación) en free tier.

**Alcance** (definición «Observabilidad: Sentry, logs, guía de depuración» del backlog spec §11 + ADR 0007):
- **Logging estructurado**: formato y niveles; **`request_id` de correlación** generado en la puerta, en cada log de error y en el envelope de respuesta (ADR 0007 §6); sin secrets ni datos sensibles jamás en logs (OWASP A05).
- **Errores → Sentry** (spec §7, free tier): qué se envía (solo errores inesperados / 5xx, no 4xx esperados), sin PII ni payloads sensibles, agrupación por `code`/`request_id`.
- **Health/estado**: `/health` con `{ status: "ok" | "degraded" }` (api-v1 §4) — qué comprueba (Supabase up, migraciones aplicadas) y cómo se usa en el keep-alive (cicd.md).
- **Guía de depuración** (documento): cómo correlacionar un `request_id` de la app con los logs/Sentry, entorno dev vs prod, y qué NO loguear.

**Decisiones a fijar**: formato de log y niveles, integración Sentry concreta en el stack Next.js (free tier, sin PII), criterio de envío (qué es error vs expected), contenido de la guía de depuración y dónde vive (docs/infrastructure o guía propia).

**Criterios de aceptación**: TODO error de puerta emite log con `request_id` y el envelope lo devuelve (ADR 0007); los logs no contienen secrets/nunca `NEXT_PUBLIC_` credenciales; Sentry en free tier sin PII; guía de depuración escrita y verificada contra el repo.

**Referencias**: ADR 0007 §6, spec API v1 §4 (`/health`), spec diseño §7/§11 (Sentry, observabilidad), `docs/flows/cicd.md`, task-02 (puertas).