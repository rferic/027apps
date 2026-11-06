---
id: sprint-06-task-02
titulo: Setup i18n y ayuda pública de Firebase
area: web
estado: finalizada
adrs: [0004, 0005]
plan: docs/superpowers/plans/2026-11-06-setup-i18n-help.md
spec: docs/superpowers/specs/2026-11-06-setup-i18n-help-design.md
---

**Alcance**: selector de idioma persistido (`027_locale`) en los cinco pasos del wizard y en `/help/firebase`; diccionarios leídos del repo; `t()` con interpolación `{param}`; página pública de ayuda de Firebase abierta desde `Step 5 · Notifications`; propuesta de `default_locale` en Preferences; proxy sin Supabase para `/help/*`; traducciones de las cadenas nuevas a los 8 locales.

**TDD**: resolución de locale y cookie; selector; pasos del wizard traducidos; propuesta de default locale; enlace de ayuda; página pública sin Supabase; interpolación; `i18n:check`.

**DoD**: TDD, `lint`, `tsc`, tests, `i18n:check`, build del admin, auditorías QA/OWASP y estilo, y docs actualizadas (`docs/flows/i18n.md`, `docs/flows/fcm-validation.md` cuando exista en la rama).

## Informe de auditoría (2026-11-06)

**QA + OWASP (`ingeniero`) — APTO CON OBSERVACIONES.**

- *Medio, corregido*: `isPublicHelpPath` publicaba cualquier subruta `/help/*` sin sesión. Se sustituyó el prefijo por una allowlist explícita (`/help`, `/help/firebase`) con normalización de barra final y tests negativos para `/help/other` y `/help/firebase/secret`.
- *Bajo, corregido*: clase `capitalize` muerta en `EnvironmentChecklist`.
- *Bajo, rechazado con motivo*: el select de `default_locale` muestra el código ISO en vez del nombre nativo. La spec §5.3 reserva los nombres nativos para el selector de interfaz; el select de instancia refleja el valor guardado y no cambia de comportamiento en esta tarea.
- Verificado sin hallazgo: locale hostil no reflejado, cambio de idioma sin perder paso ni valores, `/help/firebase` sin Supabase conservando CSP, guía sin secretos, enlaces externos con `rel="noopener noreferrer"`, interpolación sin inyección/`undefined`, propuesta de `default_locale` que no sobrescribe valores guardados.

**Estilo (`cocinero`) — APTO CON OBSERVACIONES.**

- *Crítico reportado, descartado*: `catalog.en.json` supuestamente desordenado. `pnpm i18n:scan`, que reescribe el catálogo en orden canónico (`localeCompare`), no produce ningún diff: el catálogo ya era canónico. El orden percibido como incorrecto es el de `localeCompare` (minúsculas antes que mayúsculas).
- Sin hallazgos en idioma de código/comentarios, `any`, `console.log`, código muerto, tokens semánticos, naming, literales `t("...")`, formato JSON y Conventional Commits.

**Gates finales**: `pnpm lint`, `pnpm tsc`, `pnpm test` (26 i18n + 112 core + 102 admin + 91 db-tests), `pnpm i18n:check` (111 cadenas, 9 locales) y `pnpm --filter admin build`, todos en verde.

## Informe de auditoría — segunda ronda (2026-11-06)

Auditoría del delta posterior a la primera ronda: vuelta al paso 3 desde Preferences, cabecera del wizard, allowlist de `/help`, `allowedDevOrigins` y el fix de `db-tests`.

**QA + OWASP (`ingeniero`) — APTO.**

- *Medio, corregido*: el `afterAll` de `packages/db-tests/src/auth/setup.test.ts` podía dejar desactivados los super_admins reales del stack local si `cleanup()` lanzaba. Se envolvió en `try { await cleanup(); } finally { await restoreRealAdmins(); }`.
- *Bajo, rechazado con motivo*: `backToSmtpAction` no comprueba sesión. Solo revoca la marca `SMTP_COOKIE` del navegador que la invoca (no concede privilegios ni afecta a otros usuarios) y Next 16 valida el origen en los POST de server actions; la asimetría con `confirmSmtpAction` es deliberada: una concede estado, la otra lo revoca.
- Verificado sin hallazgo: normalización de `isPublicHelpPath` (`/HELP`, `/help//`, `..`, query string), `allowedDevOrigins` limitado a desarrollo, tests de regresión que fallan sin el fix, renombrado `bodyMessage` conforme al ADR 0007 y paridad byte a byte de las dos claves i18n nuevas con los hints de `packages/core/src/setup/environment.ts`.

**Estilo (`cocinero`) — APTO CON OBSERVACIONES.**

- *Trivial, rechazado*: espaciado del envoltorio de `it.each` en `public-paths.test.ts`. El repo no usa prettier; el salto de línea es el que impone el límite de longitud y es coherente con el resto del fichero.
- Sin hallazgos en idioma de código y comentarios, naming, `any`, `console.log`, código muerto, tokens semánticos, comillas por paquete, longitud de línea, formato JSON ni Conventional Commits.

**Docs**: la spec §5.3 se corrigió a "logo centrado y selector a la derecha" para que refleje el resultado final aprobado por el usuario.
