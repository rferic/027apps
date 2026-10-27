---
id: sprint-core-design-task-10
titulo: Seguridad de definición — checklist OWASP, modelo de amenazas, secrets, RLS, dependencias (definición)
area: core
estado: finalizada
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

**Estado (2026-10-27):** spec + `docs/conventions/security-checklist.md` (A01–**A11**) + `SECURITY.md` + `.github/dependabot.yml` (semanal, agrupado npm/actions/gradle, **sin auto-merge**), enlazado desde el DoD punto 7.
- **Modelo de amenazas T1–T15**: incluye **XSS/CSRF del panel**, **APK comprometido** y **cuenta del operador comprometida**; declara fuera de modelo el proveedor cloud, malware del dispositivo, DDoS volumétrico y la desaparición del mantenedor. Riesgos residuales honestos (incl. pérdida de la clave maestra = secretos irrecuperables).
- **Checklist A11 Android**: manifest mínimo (`allowBackup=false`, `debuggable=false`), `cleartextTrafficPermitted=false`, Keystore para la sesión, deep links validados, sin tokens en logs, R8 + `apksigner`, dependencias Gradle.
- **Desambiguación** `mcp_exposed` (módulo, 3 niveles, default `read`) vs `mcp_access` (setting, `none` por defecto); MCP valida `Origin`/`Host`; prioridad i18n `manual > import > code > module` como ítem.
- **CSRF/cookies**: `HttpOnly`+`Secure`+`SameSite`, PKCE, mutaciones por `Bearer`, `Origin` en acciones sensibles; comparación de hashes en **tiempo constante**.
- **Estado real de controles**: `guard-secrets` ampliado a `027_svc_`/`027_usr_`/`SETTINGS_ENCRYPTION_KEY=` y `CODEOWNERS`/protección de `main` quedan como **delta de infra**, marcados `✘` en la checklist mientras falten. **Con dueño creado**: `sprint-infra` task-10 (`CODEOWNERS`) y task-11 (`guard-secrets`); backups en la rama `sprint/infra-backups`.

**Criterios de aceptación**: checklist con A01–A11 y controles verificables, enlazada desde el DoD; modelo T1–T15 con mitigación y residual + fuera de modelo; política de secretos con clasificación/estado real; patrón RLS canónico; Dependabot con fichero real; `SECURITY.md` en inglés con canal privado, APK en alcance y sin SLA; revisado por segundo agente y auditoría.

**Referencias**: `docs/superpowers/specs/2026-10-26-seguridad.md`, `docs/conventions/security-checklist.md`, `SECURITY.md`, `.github/dependabot.yml`, DoD, `docs/flows/cicd.md`, task-01/04/05/06/09.
