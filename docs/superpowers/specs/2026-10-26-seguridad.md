# Spec — Core: seguridad de definición (sprint 04, task 10)

**Fecha:** 2026-10-26 · **Revisión:** 2 (2026-10-27)
**Estado:** Borrador para aprobación del usuario
**Base:** [DoD](../../conventions/definition-of-done.md) (auditoría incondicional) · [spec de diseño §4/§8/§11](2026-10-24-027apps-design.md) (seguridad, secrets, checklist OWASP) · [spec de datos](2026-10-26-core-data-model.md) (RLS, actores, atribución) · [spec de config](2026-10-26-instance-config.md) §5 (cifrado de secretos) · [realtime](2026-10-26-realtime-notificaciones.md) (canales, `members_fn`) · [MCP](2026-10-26-mcp.md) (claves, `role_cap`, deny-by-default) · [i18n](2026-10-26-i18n-operativa.md) (suplantación entre módulos) · [cicd](../../flows/cicd.md) (`guard-secrets`)
**Decide el usuario:** entregables, modelo de amenazas, dependabot, enlace al DoD (2026-10-27)

## 1. Objetivo

Convertir en **sistema ejecutable** lo que hasta ahora estaba disperso o solo en la cabeza: una **checklist OWASP aplicable a cada tarea**, un **modelo de amenazas** explícito (con lo que **no** cubrimos), una **política de secretos** formal, el **patrón RLS canónico** y la **cadena de suministro** (dependabot + pinning).

**Principio**: la seguridad se **verifica**, no se recuerda. Lo mecánico va al CI; lo semántico, a una checklist con criterios concretos; lo que no se puede verificar, se declara como riesgo residual.

## 2. Entregables

| Documento | Para qué |
|---|---|
| `docs/conventions/security-checklist.md` | **Checklist ejecutable** por tarea (la usa el auditor). Enlazada desde el DoD punto 7 |
| `SECURITY.md` (raíz, inglés) | Cómo **reportar** una vulnerabilidad (privado), alcance y expectativas |
| Esta spec | Modelo de amenazas, política de secretos, patrón RLS canónico, cadena de suministro |

## 3. Modelo de amenazas (instancia familiar autoalojada)

**Activos**: datos de la familia (gastos, miembros, invitaciones), credenciales (sesiones Supabase, claves API), secretos de instancia (SMTP, FCM, futuras claves LLM), disponibilidad.

**Supuestos**: instancia privada; usuarios **invitados**; repo **público**; free tiers; el operador es el propietario (no hay equipo de operaciones).

| # | Amenaza | Escenario | Mitigación | Riesgo residual |
|---|---|---|---|---|
| T1 | **Toma de control en `/setup`** | Alguien llega antes que el propietario a una instancia sin admin | Ventana mínima (admin en el paso 2), **creación atómica** + re-chequeo, rate limit por IP, auditoría, `requires_setup` deja de ser público al existir admin | Instancia recién desplegada y sin configurar es vulnerable hasta que el propietario crea el admin |
| T2 | **Robo de dispositivo** | Móvil perdido con sesión activa | Sesión revocable por dispositivo; `DELETE /devices` y revocación desde el panel; contraseña como credencial de recuperación; almacén seguro del SO | Ventana hasta que se revoca; el atacante con el dispositivo desbloqueado actúa como el usuario |
| T3 | **Clave de API filtrada** | Clave `027_svc_`/`027_usr_` en un log, un repo o un chat | Solo hash en BD, prefijo identificable, scopes + `role_cap`, revocación instantánea **sin caché** (tarea 09), `guard-secrets` con todos los prefijos, rotación | Ventana hasta detectar y revocar; una clave `service` con `role_cap=super_admin` filtrada es crítica |
| T4 | **Módulo malicioso o descuidado** | Un módulo ejecuta DDL destructivo, sobrescribe textos del Core, publica en canales ajenos **o inyecta una página en el panel** (`admin_pages`) que corre mismo-origen con la sesión del admin | DDL validado (esquema + digest + rol acotado), confirmación humana del diff, `members_fn` propia, prioridad `code > module` en i18n, publicación solo a canales declarados; **las páginas de módulo son código first-party revisado en PR** con el mismo lint/CSP que el Core y solo se sirven si el módulo está `active` (task-12 §6) | Instalar un módulo **otorga la confianza de haber revisado su código** (incluida su UI). Un módulo de origen no revisado exigiría aislamiento (iframe/origen separado), que **no** existe en v1 |
| T5 | **Dependencia comprometida** | Paquete npm con versión maliciosa o CVE | Dependabot (semanal + security), lockfile, acciones por SHA, revisión de dependencias nuevas con caso real (ADR 0005), CI determinista | Un compromiso *upstream* puede pasar el CI; el lockfile y la revisión reducen la ventana |
| T6 | **Exfiltración de BD** | Credenciales de Supabase o `service_role`/`sb_secret_*` filtradas | Claves solo en env del hosting, nunca en cliente (`NEXT_PUBLIC_*` prohibido para secretos), RLS como segunda barrera, `guard-secrets` | Quien obtiene la clave de servicio salta RLS por diseño |
| T7 | **Pérdida de datos / backup** | Borrado accidental, migración defectuosa, proyecto destruido | Backup diario cifrado off-site; **clave maestra custodiada aparte** (backup + clave = texto claro); runbook de restauración | Pérdida entre el último backup y el incidente (granularidad diaria); pérdida de la clave maestra = secretos irrecuperables |
| T8 | **Agente MCP que actúa de más** | Un agente con clave `service` ejecuta acciones destructivas o lee de más | `/mcp/admin` exige `role_cap=super_admin` + scopes; allowlist de tools; **nada de DDL ni claves**; `confirm: true` en destructivas; rate limit y auditoría | Un agente puede ejecutar cualquier acción **permitida** por sus scopes; el operador debe conceder el mínimo |
| T9 | **Prompt injection** | Un texto de usuario (nombre de grupo, gasto) intenta dirigir al agente | El agente **no ejecuta** texto: solo tools con esquema; datos de negocio son datos; el servidor no interpreta instrucciones del contenido | Un LLM puede dejarse influir; la defensa real es el **límite de scopes** y la confirmación de destructivas |
| T10 | **Insider / colaborador del repo** | Alguien con escritura edita un workflow y exfiltra secretos de CI | Protección de rama + CODEOWNERS sobre `.github/workflows/`, acciones por SHA, secretos por `env` en el paso, sin `pull_request_target` | Un admin del repo puede cambiar todo; es el mismo nivel de confianza que el propietario |
| T11 | **Error de configuración** | CORS `*`, rate limit desactivado, `security.*` mal puesto | `security.*`/CORS solo `super_admin`; `security.*` con `mcp_access=none`; defaults seguros (sin `*`, límites activos) | Un `super_admin` comprometido puede relajar la configuración |
| T12 | **Instancia pausada / borrada** | Free tier pausa por inactividad; cuenta cerrada | Keep-alive diario; backup off-site; documentación de reconstrucción | Ventana de pausa hasta el keep-alive; el backup limita la pérdida |
| T13 | **XSS / CSRF en el panel** | Un nombre de usuario, un texto importado **o una página de módulo** inyecta script; una acción sensible se dispara desde otro origen con la cookie del panel | Escapado por defecto de React, **prohibido `dangerouslySetInnerHTML`** con datos, **CSP** `script-src 'self'`, cabeceras de seguridad, cookies `HttpOnly`/`Secure`/`SameSite`, mutaciones por `/api/v1` con `Bearer` (no cookie), verificación de `Origin` en acciones sensibles, y páginas de módulo como código revisado (T4) | Un XSS con sesión válida puede actuar como el admin hasta el `JWT_EXPIRY`; una página de módulo maliciosa es indistinguible de una del Core por diseño (misma confianza) |
| T14 | **APK comprometido / suplantado** | Un tercero publica un APK con el mismo nombre y distinta firma | Firma propia verificada (`apksigner`), distribución por enlace oficial, `debuggable=false`, sin secretos en el APK, Keystore del dispositivo | Quien instala un APK de un enlace no oficial no tiene protección técnica |
| T15 | **Cuenta del operador comprometida** | Alguien entra en la consola de Supabase/Vercel del propietario | 2FA en los proveedores, secretos en env, backup off-site, rotación | Equivale a propietario comprometido: **mismo nivel de confianza**; no se mitiga desde el código |

**Fuera del modelo** (declarado): ataques de red a Supabase/Vercel/Google, compromiso **del proveedor** cloud (distinto del compromiso de **la cuenta del operador**, que es T15), malware en el dispositivo del usuario, coacción física, DDoS volumétrico (se mitiga con los límites del proveedor), y **desaparición del mantenedor** (riesgo de proyecto, no técnico: sin él no hay actualizaciones ni Dependabot aplicado).

**Nota de estado (importante)**: este documento **define** controles; varios se **implementan** fuera de este sprint: `CODEOWNERS` y protección de `main` (infra), `dependabot.yml` (infra), backups (infra), y la ampliación de `guard-secrets` a los prefijos del proyecto (infra/CI). La checklist marca `✘` mientras no existan.

## 4. Política de secretos

### 4.1 Clasificación

| Categoría | Dónde vive | Ejemplos |
|---|---|---|
| **Plataforma** (de la instancia, pero necesaria para arrancar) | **Variables de entorno del hosting** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`/`sb_secret_*`, `SETTINGS_ENCRYPTION_KEY`, `SENTRY_DSN` (opcional) |
| **Instancia en runtime** | **BD cifrada** (`settings.value_encrypted`) | SMTP propio de la app (reservado), service account FCM, futuras LLM BYOK / clientes MCP |
| **Credenciales de usuario** | **Supabase Auth** (nunca nuestras tablas) | contraseñas, sesiones |
| **Credenciales de máquina** | **BD hasheadas** (`api_keys.key_hash`) | `027_svc_`, `027_usr_` |
| **No secretos** (públicos por diseño) | settings `is_public` | `fcm_project_id/app_id/api_key/sender_id` (web API key del cliente), `instance.public_url` |

### 4.2 Reglas

1. **Nunca** en git, logs, respuestas, eventos, `admin_actions.details`, `idempotency_keys.response` ni en el cliente (`NEXT_PUBLIC_*` jamás para un secreto).
2. **Write-only**: un secreto se fija y se ve como `configured: true`; **no** se lee por API.
3. **Cifrado**: AES-256-GCM, nonce de 12 bytes **nuevo por cifrado**, AAD = versión + clave, formato versionado (task-06 §5).
4. **Custodia de la clave maestra**: gestor de secretos **separado** del backup de la BD; pérdida = secretos irrecuperables (declarado en T7).
5. **Rotación**: con doble clave (descifrar con la anterior, re-cifrar con la nueva) y ventana documentada. Las claves de máquina, con `expires_at` cuando se usan en CI (el workflow de mantenimiento).
6. **`guard-secrets` en CI** **debe** detectar: `sb_secret_*`, `sbp_`, JWT, `SERVICE_ROLE_KEY=`, PEM privadas, **`027_svc_`/`027_usr_`** y `SETTINGS_ENCRYPTION_KEY=`. **Estado**: hoy cubre los cinco primeros; la ampliación a los prefijos del proyecto es **delta pendiente** (CI de infra); la checklist marca `✘` mientras falte — sin ella, un secreto real pegado en un doc no se detecta.
7. **Secretos por `env` del paso** en workflows; nunca en `echo`, nunca en el log del job.

## 5. Patrón RLS canónico

Toda tabla nueva del Core o de un módulo cumple esto (el detalle vive en la checklist):

1. **Habilitar RLS** en la tabla. Sin política → **deny** por defecto.
2. **Usar las funciones compartidas**, no condiciones ad-hoc:
   `core_is_admin()`, `core_is_super_admin()`, `has_module_access(key)`, `core_can_subscribe(topic)`.
3. **Security definer endurecidas**: `SET search_path = ''`, `STABLE` cuando aplique, `REVOKE EXECUTE FROM PUBLIC`, **`OWNER` el rol correcto** (lección de `pg_cron`).
4. **Una política por intención**, y **nunca** una política permisiva que no compare la fila/topic (la combinación OR de políticas permisivas fue el fallo de la primera versión de realtime).
5. **Actores siempre identificables**: humano (`*_by`) o clave (`*_by_key`), con CHECK de exactamente uno; **atribución previa al borrado**.
6. **Sin auto-escalado**: el propietario no edita su `role`; `user_modules`/`user_categories` solo admin.
7. **Suite de aislamiento obligatoria** por tabla (D2): dos usuarios/categorías con datos que comparten emails/fechas, verificación de que no se filtra nada.
8. **Tests de borde** de cualquier retención o purga (la fila justo dentro no se borra).

## 6. Cadena de suministro

- **Dependabot**: semanal, agrupado por ecosistema, **sin auto-merge**; **security updates** con prioridad; acciones de terceros actualizadas por SHA. Config en `.github/dependabot.yml` (npm, github-actions y gradle).
- **Acciones de terceros**: fijadas por **SHA de commit** (las `actions/*` de GitHub pueden ir por tag mayor, según `cicd.md`); sin `pull_request_target`; `permissions: {}` por defecto.
- **`.github/CODEOWNERS`** sobre `.github/workflows/` y protección de `main` — **pendiente en infra** (marcado en la checklist).
- **Lockfile** (`pnpm-lock.yaml`) obligatorio y en CI con `--frozen-lockfile`.
- **Dependencia nueva**: solo con caso real y justificación (ADR 0005); revisar mantenimiento, licencia, tamaño y superficie.
- **SDK de terceros**: versión **pinneada**; sus **defaults de privacidad** se revisan explícitamente (lección de Sentry: `sendDefaultPii`, `event.request`, IPs).

## 7. Cómo se usa la checklist

- Cada tarea declara en su frontmatter `adrs:` (DoD) y **el auditor recorre la checklist** marcando: aplica / no aplica / cumple.
- Un hallazgo **crítico o alto** sin resolver **bloquea** `finalizada`.
- Si un fallo se repite en dos tareas, se convierte en **check mecánico** (lint, script o CI) y se añade a la checklist como "verificado por herramienta".

## 8. Decisiones tomadas (2026-10-27)

| # | Decisión |
|---|---|
| A | **Tres entregables**: spec + `docs/conventions/security-checklist.md` + `SECURITY.md` (inglés) |
| B | **Modelo de amenazas** de 12 escenarios con mitigación y **riesgo residual**, incluyendo las lecciones de las auditorías (SDK fail-open, rol de jobs, suplantación i18n) y lo que queda **fuera** del modelo |
| C | **Dependabot** semanal agrupado, **sin auto-merge**, security updates prioritarias; acciones por SHA y lockfile |
| D | **Checklist enlazada desde el DoD** (el DoD sigue siendo la norma; la checklist es el detalle ejecutable) |
| E | **Patrón RLS canónico** con funciones compartidas, definers endurecidas, actores identificables y suite de aislamiento por tabla |

## 9. Fuera de alcance

- **Pentest** o auditoría externa (no en esta fase).
- **Firma criptográfica de módulos** (diferida en task-03).
- **OAuth 2.1** (backlog `sprint-mcp-oauth`).
- **Cifrado de la BD en reposo** (lo da Supabase; el backup se cifra aparte).
- **Bug bounty / programa de divulgación** (SECURITY.md da el canal privado, sin programa formal).

## 10. Criterios de aceptación

- Existe la checklist con los 10 OWASP y **controles concretos del proyecto**, enlazada desde el DoD.
- El modelo de amenazas cubre los 12 escenarios con mitigación y riesgo residual, y declara lo que queda fuera.
- La política de secretos clasifica los 5 tipos, prohíbe las superficies de fuga y define custodia/rotación de la clave maestra.
- El patrón RLS es copiable y exige suite de aislamiento por tabla.
- Dependabot (semanal, agrupado, sin auto-merge) + pinning + lockfile definidos.
- `SECURITY.md` publicado en inglés con canal privado y alcance.
- Revisado por segundo agente y **auditoría OWASP** (la propia checklist se audita con ella).

## 11. Referencias

- DoD: `docs/conventions/definition-of-done.md` · Checklist: `docs/conventions/security-checklist.md` · `SECURITY.md`
- Specs: datos, config (secretos), realtime (canales), MCP (claves), i18n (suplantación)
- Flujos: `docs/flows/cicd.md` (`guard-secrets`, acciones por SHA)
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md` · Task: `docs/tasks/sprint-core-design/task-10.md`