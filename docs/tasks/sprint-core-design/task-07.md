---
id: sprint-core-design-task-07
titulo: Trabajos programados y mantenimiento del Core — spec (definición)
area: core
estado: test
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 7 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md` — qué se ejecuta de forma programada en el Core y dónde corre.

**Alcance** (trabajo interno del Core, distinto del keep-alive de servicios que ya vive en infra):
- **Jobs de dominio**: **despacho/reintento y purga de `event_outbox`** (entrega at-least-once y hooks idempotentes — task-04, decisión E), expiración de invitaciones (`invitations.expires_at`, token de un solo uso), rotación/limpieza de tokens revocados o expirados (`api_keys`), cierre de **ventanas de auditoría agregada** (`audit` con `window_start` — spec de tokens §6), actualización/agregación de `last_used_at`, y cualquier mantenimiento que el esquema de la task-01 revele.
- **Dónde corren en free tier**: candidatos a evaluar — `pg_cron` dentro de Supabase (Postgres), GitHub Actions (workflow schedule, ya usado para keep-alive), Vercel cron, o trigger desde la API. Sin máquina propia (spec §2): la decisión es de este sprint.
- **Superficie de mantenimiento autenticada**: si un job toca la API (p. ej. cierre de ventanas), cómo se autentica (clave de instancia, endpoint de mantenimiento con su scope — ADR 0004) sin exponer secrets.

**Decisiones a fijar**: lista definitiva de jobs con periodicidad y responsable (cron/DB/API), mecanismo elegido en free tier, idempotencia y tolerancia a fallos de cada job, cómo se verifican (health), relación con `/health` (api-v1 §4, `ok`/`degraded`) y con el keep-alive de servicios (cicd.md, `PROD_URL`).

**Estado (2026-10-26):** spec `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md` redactada.
- **Modelo híbrido** (decisión del usuario): despacho **inline tras el commit** (primario, task-04) + **lazy sweep** al recibir tráfico (1 consulta cada ≥5 min por proceso, barrido en segundo plano) + **`pg_cron`** para SQL puro + **GitHub Actions horario** para lo que necesita HTTP. Vercel Cron descartado para reintentos (Hobby = 1/día).
- **Inventario**: `outbox.retry`, `outbox.purge`, `idempotency.purge`, `audit.roll`, `invitations.purge`, `api_keys.purge`, `rate_limit.purge`, `maintenance.purge`, `health.evaluate` — todos idempotentes.
- **Endpoint**: `POST /api/v1/maintenance/run` (clave de instancia + scope `maintenance:run`, advisory lock, 409 si concurre) y `GET /maintenance/status` (`is_super_admin()`). Sin acciones de negocio ni DDL.
- **Retenciones**: outbox publicado 7 d / fallido 30 d · idempotencia 24 h · `audit` 90 d · invitaciones 30 d · claves 90 d · `maintenance_runs` 90 d.
- **Salud**: `/health` degrada con pendientes > 1 h, fallos recientes o barrido atrasado con pendientes; sin detalles públicos.
- **Deltas aplicadas**: task-01 (`maintenance_runs` + decisión X), task-02 (endpoints de mantenimiento y semántica de `/health`).

**Criterios de aceptación**: cada job con mecanismo, frecuencia, idempotencia y retención; endpoint con clave + lock; outbox.retry sin duplicar eventos ni hooks; `/health` degradando con outbox atascado; `cicd.md` actualizado al implementar `maintenance.yml`.

**Referencias**: `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md`, task-04 (`event_outbox`), task-05 (`idempotency_keys`), task-01 (`audit`), task-02 (`/health`), `docs/flows/cicd.md`.
