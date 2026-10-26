---
id: sprint-core-design-task-10
titulo: Seguridad de definición — checklist OWASP, modelo de amenazas, secrets, RLS, dependencias (definición)
area: core
estado: pendiente
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

**Criterios de aceptación**: la checklist es usable por un auditor distinto del autor en cada tarea; el patrón RLS es copiable y su suite de aislamiento obligatoria; la política de secrets no contradice `AGENTS.md`/`cicd.md`; dependabot queda definido para el repo público.

**Referencias**: `docs/conventions/definition-of-done.md` (auditoría incondicional), spec diseño §4/§8/§11 (seguridad, secrets), `docs/flows/cicd.md` (guard-secrets), ADR 0004 (guard), ADR 0005 (dependencias), task-01 (patrón RLS).