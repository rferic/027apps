---
id: sprint-core-design-task-07
titulo: Trabajos programados y mantenimiento del Core — spec (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 7 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md` — qué se ejecuta de forma programada en el Core y dónde corre.

**Alcance** (trabajo interno del Core, distinto del keep-alive de servicios que ya vive en infra):
- **Jobs de dominio**: expiración de invitaciones (`invitations.expires_at`, token de un solo uso), rotación/limpieza de tokens revocados o expirados (`api_keys`), cierre de **ventanas de auditoría agregada** (`audit` con `window_start` — spec de tokens §6), actualización/agregación de `last_used_at`, y cualquier mantenimiento que el esquema de la task-01 revele.
- **Dónde corren en free tier**: candidatos a evaluar — `pg_cron` dentro de Supabase (Postgres), GitHub Actions (workflow schedule, ya usado para keep-alive), Vercel cron, o trigger desde la API. Sin máquina propia (spec §2): la decisión es de este sprint.
- **Superficie de mantenimiento autenticada**: si un job toca la API (p. ej. cierre de ventanas), cómo se autentica (clave de instancia, endpoint de mantenimiento con su scope — ADR 0004) sin exponer secrets.

**Decisiones a fijar**: lista definitiva de jobs con periodicidad y responsable (cron/DB/API), mecanismo elegido en free tier, idempotencia y tolerancia a fallos de cada job, cómo se verifican (health), relación con `/health` (api-v1 §4, `ok`/`degraded`) y con el keep-alive de servicios (cicd.md, `PROD_URL`).

**Criterios de aceptación**: cada job tiene disparador, periodicidad y lugar de ejecución decididos y justificados en free tier; los jobs son idempotentes; nada de secrets en el mecanismo; coherente con la auditoría de uso (spec de tokens §6) y con `cicd.md`.

**Referencias**: spec de tokens §6/§7 (`2026-10-25-token-model.md`), `docs/flows/cicd.md` (keep-alive, job `release`), spec API v1 §4 (`/health`), task-01 (esquema), task-06 (`instance_settings`).