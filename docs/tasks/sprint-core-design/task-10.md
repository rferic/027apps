---
id: sprint-core-design-task-10
titulo: Seguridad de definición — checklist OWASP, modelo de amenazas, secrets, RLS, dependencias (definición)
area: core
estado: test
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 10 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega documentación de seguridad aprobada, sin código.

**Entregable**: `docs/superpowers/specs/2026-10-26-seguridad.md` (definiciones de seguridad del backlog spec §11): **checklist OWASP del proyecto** + **modelo de amenazas simple** + **política de secrets** + **patrón RLS estándar** y **auditoría de dependencias**.

**Alcance**:
- **Checklist OWASP del proyecto**: la lista de chequeo concreta que usarán los auditores (DoD, auditoría incondicional) de cada tarea — A01 control de acceso (guard/adm/autorización), A02/A05 exposición de datos y secrets, A03 inyección/validación (zod), A07 auth/sesión/tokens, A04/A09 rate limiting y fallos explícitos, A08 cadena de suministro. Tiene que ser **ejecutable desde el frontmatter `adrs:` del DoD**.
- **Modelo de amenazas simple**: amenazas del escenario familiar auto-hospedado (instancia privada, invitados, free tiers, repo público) y qué capa las mitiga (RLS, guard, secrets, rate limiting, wizard de setup).
- **Política de secrets**: lo **por-instancia en runtime** cifrado en `settings` (`value_encrypted`, modelo de la task-01; clave maestra en env) vs lo **de plataforma** en variables de entorno (spec §8); nunca en git/logs/CI salida (AGENTS.md); papel de `guard-secrets`.
- **Patrón RLS estándar**: la plantilla canónica de políticas RLS por tabla (scoped por grupo), su nomenclatura y su suite de aislamiento — para que toda tabla nueva la copie (spec §4).
- **Auditoría de dependencias**: `dependabot` (o equivalente) y qué se exige en revisión de dependencias nuevas (ADR 0005 §elección de librería: solo con caso real).

**Decisiones a fijar**: estructura de la checklist y cómo se engancha al DoD, contenido del modelo de amenazas, patrón RLS canónico (dónde vive, cómo se copia), política de secrets formal, configuración de dependabot.

**Estado (2026-10-27):** spec `docs/superpowers/specs/2026-10-26-seguridad.md` + **`docs/conventions/security-checklist.md`** + **`SECURITY.md`** (inglés).
- **Modelo de amenazas** de 12 escenarios (T1–T12) con mitigación y **riesgo residual**, incluidas las lecciones de las auditorías: defaults fail-open de SDK, rol de `pg_cron`, suplantación i18n entre módulos, locks de sesión inviables. Declara lo que queda **fuera** (proveedor cloud, malware del dispositivo, DDoS volumétrico).
- **Política de secretos**: 5 categorías (plataforma en env / instancia cifrada / usuario en Supabase / máquina hasheada / **no secretos** como `fcm_api_key` y DSN), prohibición de superficies de fuga, cifrado AES-GCM con nonce y AAD, **custodia de la clave maestra separada del backup**, rotación con doble clave, y `guard-secrets` con todos los prefijos (`sb_`, `027_svc_`, `027_usr_`, `SETTINGS_ENCRYPTION_KEY`).
- **Patrón RLS canónico** (8 reglas): deny por defecto, funciones compartidas, definers con `OWNER` correcto, **nada de políticas permisivas sin comparar fila/topic**, actores identificables, atribución antes del borrado, suite de aislamiento por tabla y tests de borde de retención.
- **Cadena de suministro**: **Dependabot** semanal agrupado **sin auto-merge** con security updates prioritarias; acciones por SHA; lockfile; dependencias nuevas solo con caso real; SDK pinneados y **defaults de privacidad revisados**.
- **Checklist** enlazada desde el **DoD punto 7** (el DoD sigue siendo la norma).

**Criterios de aceptación**: checklist con A01–A10 y controles concretos enlazada desde el DoD; modelo de amenazas con mitigación y riesgo residual + fuera de modelo; política de secretos con clasificación, prohibiciones, custodia y rotación; patrón RLS copiable con suite de aislamiento; dependabot/pinning/lockfile; `SECURITY.md` con canal privado y alcance; revisado por segundo agente y auditoría OWASP.

**Referencias**: `docs/superpowers/specs/2026-10-26-seguridad.md`, `docs/conventions/security-checklist.md`, `SECURITY.md`, DoD, `docs/flows/cicd.md`, task-01/04/05/06/09.
