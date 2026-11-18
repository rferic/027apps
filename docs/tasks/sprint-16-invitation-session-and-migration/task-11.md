---
id: sprint-16-task-11
titulo: Cierre — i18n, docs, gates, auditoría y verificación real
area: docs + infra
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0002, 0004, 0007, 0008, 0010]
---

**Tarea**: cerrar el sprint con todo verificado y auditable: i18n completo, flujos actualizados,
gates mecánicos, evidencia real y auditoría de seguridad. Sin esto ninguna tarea pasa a
`finalizada`.

**En curso (2026-11-17)**

- App Android a `0.19.0`/`1900`. `Changelog.kt` lleva la entrada del sprint en **los nueve
  idiomas** (`Changelog.shippedLocales`), y `ChangelogTest` falla si la versión en curso no está en
  todos; las entradas antiguas siguen en es/en y la pantalla cae a inglés para ellas.
- Flujos nuevos: `docs/flows/invitations.md` (estados, preview, canje de cuenta nueva y existente,
  app-first, renovar/revocar, invariantes, prueba local) y `docs/flows/password-recovery.md`
  (camino completo, 700 ms, 5/h IP y 3/h email, GET que no consume, operación).
- `scripts/verify-local.sh` comprueba también las páginas públicas sin sesión (`/login`,
  `/forgot-password`, `/migrate/<token>`) y que su HTML no traiga error de ejecución; ejecutado
  contra la instancia local: todo en verde.
- `docs/flows/pre-delivery-verification.md` documenta esa comprobación.
- Gates en local: `pnpm lint` (0 errores), `pnpm tsc`, `pnpm i18n:check` (1027 strings, 9 locales),
  `pnpm check:openapi` (106/106), `pnpm --filter admin build`, tests de `core` (531), `i18n` (26),
  `owe-no` (26) y `admin` (1233) en verde, y `./gradlew :app:testDebugUnitTest :app:assembleDebug`.
  `db-tests` **no** se puede dar por verde en local: la instancia del propietario ya está montada y
  sus datos hacen fallar las suites de setup/RLS (CI la ejecuta sobre base limpia).
- Auditorías de seguridad y de UX hechas por agentes distintos del autor: informe completo y
  resolución de cada hallazgo en [`task-11-audits.md`](task-11-audits.md). Catorce de seguridad y
  dieciocho de UX corregidos con tests; cinco de UX diferidos con motivo escrito.
- `docs/flows/cicd.md`: App Links de `/invite/` **y** `/migrate/`, cómo sacar la huella del
  certificado y por qué hace falta redeploy; `docs/flows/local-development.md`: reset con copia,
  restauración y tripwire.
- PR #124 con el resumen del sprint, la evidencia de los gates, las migraciones y las puertas del
  propietario (P3/P4 y orden de merge/tag), reescrito en inglés para GitHub.
- Landing pública sin cambios de copy en este sprint: los módulos y su catálogo no cambian; queda
  constancia aquí en vez de tocar `docs/ai/landing.md`.
- Revisión de estilo por un agente distinto del autor: hecha y aplicada (imports muertos, KDoc
  duplicado, `contentDescription` del QR, comentario de los colores de email, códigos de auditoría
  fuera del código, casos públicos de `/migrate`, test de `revokeSessions`, ruta del plan).
- Checklist de aceptación y lo que falta, en [`pendientes.md`](pendientes.md).
- **Release 0.19.0 publicado** (`v0.19.0`): APK firmado, huella verificada contra
  `ANDROID_APP_SHA256`, versión `1900`, App Links `/invite/` y `/migrate/` en el manifest.
- Verificación real del propietario: invitación app-first en producción (correo y cámara), cuenta
  existente, wizard web, migración de un móvil con revocación de sesión en servidor, actualización
  in-app 0.18.2 → 0.19.0 y recuperación de contraseña con email real.
- **Única comprobación pendiente**: revocación de **push** en el móvil viejo y escaneo entre dos
  dispositivos reales (P4); exige un segundo Android con FCM y un evento con push. Documentada en
  `task-10.md`.

**Punto de partida**: las tareas 03–10 implementadas y aceptadas por sus criterios.

**Alcance**
- Dentro:
  - `docs/flows/invitations.md` (ciclo completo: preview, app-first, web, existente, rol,
    renovación, estados) y `docs/flows/password-recovery.md`.
  - `docs/flows/cicd.md`: App Links y `/migrate/`; `docs/flows/pre-delivery-verification.md` y
    `scripts/verify-local.sh` si hay rutas nuevas.
  - `docs/ai/landing.md` y landing solo si cambia el copy público; si no, constancia.
  - `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm check:openapi` y
    `pnpm --filter admin build`.
  - `pnpm --filter db-tests test` sobre Supabase local limpio.
  - `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug`.
  - `scripts/verify-local.sh` con sesión real y las rutas nuevas.
  - CI del PR: `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs`.
  - Verificación real de la checklist de pre-entrega (suites, build, rutas, endpoints, APK,
    navegador con `lerd diag browser_toggle` + `request lenses`).
  - **Auditoría de seguridad** OWASP A01–A11 por un agente distinto de quien implementó, con la
    checklist `docs/conventions/security-checklist.md` (incluye A11 Android); informe con
    hallazgos, severidad y resolución.
  - **Auditoría de UX** por un agente distinto de quien implementó: flujos app/web,
    estados vacío/carga/error/sin conexión, copy en los 9 idiomas, contraste claro/oscuro, 375 px
    web y 390 px app, teclado y lector de pantalla, QR legible en claro y oscuro, reset,
    bienvenida y migración; capturas reales o código + APK si no hay dispositivo.
  - Revisión/QA y estilo por agentes distintos del autor.
  - Actualizar `estado` de las tareas; PR con la evidencia y el resumen para el propietario (P9).
- Fuera: merge sin orden; promoción sin orden; cambiar el alcance del sprint 17.

**Dependencias**: todas.

**Riesgos**: que un gate de CI no se pueda reproducir en local (pegar la salida de `gh pr checks`);
que `db-tests` contra la instancia del propietario falle por datos (usar una base limpia); que la
auditoría encuentre un crítico y haya que parar (se corrige con test de regresión); que la landing
se toque sin necesidad (solo si cambia el copy).

**Criterios de aceptación**
- Todos los comandos de la spec §11.5 en verde, con la salida pegada.
- Rutas y endpoints nuevos verificados con sesión real; sin errores en `request lenses`.
- APK instalado y recorrido; App Links y QR verificados en dispositivos reales.
- Recuperación con email real; sesión (reinicio, avión, actualización, logout web/móvil,
  desactivación, borrado, revocación) verificada.
- Auditoría de seguridad sin hallazgos críticos/altos abiertos; el resto con motivo escrito.
- Informe de revisión/QA/estilo con hallazgos corregidos o rechazados con motivo.
- PR draft contra `staging` con el resumen, los gates del propietario y la evidencia; sin merge.

**Puertas de usuario**
- Aprobar la evidencia y dar la orden de merge (P7) y de promoción (P8).
- Revisar el resumen de seguridad.

**Auditorías finales**: la de seguridad cierra la auditoría incondicional del sprint (A01–A11); la
de UX cubre los flujos, estados, copy, contraste y accesibilidad. Ambas las hace un agente distinto
del implementador, con informe escrito y resumen para el propietario, y siempre antes de
`finalizada`.
