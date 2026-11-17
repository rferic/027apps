---
id: sprint-16-task-03
titulo: Ciclo de sesión (logout local, expulsión limpia y errores reintentables)
area: web + app + core
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0004, 0007, 0010]
---

**Tarea**: que la sesión solo termine por logout del usuario o por expulsión, y que ni el panel ni
la app confundan un error de red con una sesión revocada.

**Implementación web, Core y Android completa 2026-11-16; pendiente la aceptación en dispositivo
real, la revisión/QA y la auditoría de seguridad antes de `finalizada`.**

**Aceptación del propietario (2026-11-17, instancia local, APK debug 0.18.2):**

- Logout en la web local → la app sigue dentro. ✔
- Logout en la app → la web local sigue dentro. ✔
- Modo avión → la app conserva la sesión y no pide login. ✔
- Reinicio → la app sigue dentro. ✔

Pendiente: desactivación/borrado/revocación y actualización (puntos 4–5), revisión/QA y
auditoría antes de `finalizada`.

**Corrección 2026-11-17 (expulsión con la app abierta)**: la aceptación detectó que, con la app
abierta, una desactivación solo se notaba al reiniciar. `ApiClient` avisa ahora con
`onSessionEnded` en el primer 401 definitivo (refresh rechazado o segundo 401 tras refrescar) y
`AppViewModel.endSession` cierra la sesión en el acto con el aviso «Tu sesión se ha revocado»;
`ON_START` revalida con `me()` al volver del segundo plano. Un fallo de red nunca cierra la
sesión. Cubierto por tests de `MockEngine` (aviso una sola vez, 401 tras refrescar, red sin
aviso) y por `:app:testDebugUnitTest` + `:app:assembleDebug`; CI en verde en `9e7cce2`.

**Punto de partida (verificado)**
- `apps/admin/src/app/(auth)/actions.ts` hace `signOut()` sin scope; en JS el default es `global`,
  así que el logout del panel revoca también la sesión del móvil.
- `panel-guard.ts` devuelve `null` para un perfil desactivado y redirige a `/login`;
  `instance-gate.ts` ve la sesión y redirige a `/panel`: bucle.
- `apps/android/.../data/ApiClient.kt` devuelve `false` por red y por refresh inválido;
  `AppViewModel.boot()` acaba en `Failure(UNKNOWN)` conservando la sesión, pero sin distinguir si
  debe limpiarla.
- `deactivateUser` desactiva el perfil, revoca claves y dispositivos, pero no borra
  `auth.sessions`; el bloqueo efectivo ya lo hace el perfil.

**Alcance**
- Dentro:
  - Web: `signOutAction` con `{ scope: "local" }`; `/logout` de mismo origen; guard de panel con
    tres casos (anónimo / perfil no usable / usuario); proxy con `ok`/`invalid`/`unavailable` y 503
    sin borrar cookies; tests.
  - Core: `UsersDeps.onDeactivated` (mejor esfuerzo) y cableado a `delete from auth.sessions`;
    **`DELETE /devices/{id}?sessions=all|local`**: `all` (por defecto, panel) borra las sesiones;
    `local` (dueño, logout del móvil) solo revoca el dispositivo; un admin sobre otro usuario
    fuerza `all`.
  - App: `RefreshResult` (`Refreshed`/`NoSession`/`Network`); `boot()` clasifica
    `awaitInitialization`, un refresco inicial, `me()`, 401, red y 5xx; `Offline`/`Failure`
    conservan la sesión; `NeedsLogin(reason)`; `signOut`/`changeInstance` con
    `SignOutScope.LOCAL` y `FcmRegistrar.revoke()` con `sessions=local`; avisos en login y copy
    «Sin conexión. Tu sesión sigue guardada.» en el estado de red (no pedir login). Un 401
    definitivo (refresh rechazado o segundo 401 tras refrescar) cierra la sesión en el acto
    mediante `ApiClient.onSessionEnded`, sin esperar al siguiente arranque, y `ON_START`
    revalida con `me()` la sesión de una app que vuelve del segundo plano.
  - Documentar el límite de 15 min del access JWT tras revocar un dispositivo/sesión (la
    desactivación y el borrado son inmediatos por el perfil); la migración fuerza refresco al
    arrancar y el viejo borra al ver `used` (S4).
- Fuera: cambiar el modelo de sesiones de Supabase; un panel de sesiones por dispositivo; el QR
  (tarea 10); la recuperación (tarea 08).

**Dependencias**: tarea 01 y mockups de la 02 para la UI de estados de sesión. La parte web/Core
puede empezar antes de P2; la UI de la app espera al mockup.

**Riesgos**: que `@supabase/ssr` borre cookies en un fallo de red (hay que probarlo y extraer la
clasificación); que el error de refresh de supabase-kt no exponga un código estable (mapear por
tipo/status y cubrirlo con tests de MockEngine); que el logout local deje el refresh token vivo
(se revoca en el servidor con `local`); que la baja del dispositivo móvil siga borrando todas las
sesiones (por eso `sessions=local` y el test del dueño/admin).

**Criterios de aceptación**
- Logout web no cierra la sesión del móvil; logout móvil no cierra la web ni los demás móviles
  (`DELETE /devices/{id}?sessions=local`).
- El panel sigue expulsando: revocar un dispositivo de otro usuario borra sus sesiones (`all`).
- Reinicio, actualización y modo avión conservan la sesión; al volver la red, «Reintentar» entra.
- Un 401 por refresh inválido limpia la sesión y muestra «sesión revocada»; un 401 por red no.
- Un perfil desactivado va a `/logout` → `/login` sin bucle; el móvil recibe 401 y limpia.
- La desactivación borra `auth.sessions` (mejor esfuerzo) y no rompe la baja si falla.
- `pnpm lint && pnpm tsc && pnpm test` y `./gradlew :app:testDebugUnitTest` en verde.
- Verificación real de la lista de sesión de la spec §11.5.

**Puertas de usuario**
- Aprobar la spec y el plan; el mockup de los estados de sesión (P2).
- Probar en un dispositivo y en el navegador con una cuenta temporal.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A07, A09): logout, refresh,
expulsión, sesiones en logs y CSRF de `/logout`.
