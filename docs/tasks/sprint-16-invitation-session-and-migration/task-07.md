---
id: sprint-16-task-07
titulo: Wizard web, aviso Android 8+ y auto-login A1
area: web
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: convertir `/invite/[token]` en un wizard app-first que no sea una puerta: aviso de que
solo hay app Android (8+), descarga del APK, reintento de apertura sin bucle y canje web completo,
con QR en escritorio y auto-login para roles de panel.

**Implementación completa 2026-11-17; en revisión/QA y aceptación del propietario antes de
`finalizada`.**

- La página resuelve el preview en el servidor (`instant = false` + `connection()`), aplica 60/min
  por IP antes de la base de datos, usa el idioma de la invitación (cookie solo como fallback) y
  elige Android/iPhone/escritorio por user-agent. Estados `used`/`expired`/invalid/404 con la
  misma tarjeta genérica para desconocida y revocada.
- Wizard Android: aviso literal, «Abrir en la app» (esquema `027apps://invite/<token>?instance=…`
  con timeout de 1,5 s y sin navegación automática), descarga con versión, reintento y
  «Continuar en el navegador» en todos los pasos. iPhone: aviso y canje web. Escritorio: formulario
  completo + QR generado en el servidor con `qrcode` (SVG en blanco y negro, sin servicio externo
  ni `data:`), con la URL de la instancia desde `instance.public_url`.
- Formulario: los datos de la invitación son una ficha (email, nombre, instancia, invitador, rol,
  caducidad), nunca inputs editables; cuenta nueva pide contraseña + confirmación; cuenta existente
  pide la contraseña actual, enlaza a `/forgot-password` y no la cambia.
- Server action `submitInvitation`: zod + origen + 30/min por IP (`redeem-action:<ip>`),
  re-resuelve el preview y, para una cuenta existente, **firma primero** con Supabase (contraseña
  mala → error inline, sin canjear) y canjea con esa sesión; para una nueva canjea y luego firma.
  Rol de panel → `/panel`; `user` → cierre local y `/welcome`; login automático fallido →
  `/welcome?notice=signin_failed`. La web ya no usa el endpoint público.
- `/welcome`: página pública con «cuenta creada», descarga Android, enlace a login y explicación de
  que el panel es solo para administradores; añadida a `public-paths.ts`. Al canjear, la action
  guarda el idioma de la invitación en la cookie `027_locale`, así `/welcome` y el panel siguen en
  ese idioma en vez de caer al del navegador.
- Dependencia `qrcode` (MIT) + `@types/qrcode`; sin CSP nueva.
- i18n de todo (42 claves nuevas en 9 idiomas) y `pnpm i18n:check` en verde.

**Tests**: página (locale del preview, invalid/404/used/expired, rate limit, Android/iPhone/
escritorio, QR, token no pintado), formulario (ficha, nueva vs existente, límites, forgot),
`submitInvite`/`submitOnce` y action (firma primero, contraseña mala sin canjear, rol de panel vs
`user`, fallo de auto-login, used/expired, rate limit, validación). `pnpm --filter admin test`
(1211), `pnpm --filter admin lint`, `pnpm --filter admin tsc`, `pnpm --filter admin build`,
`pnpm i18n:check`.

**Auditoría de seguridad (2026-11-17)**

- A01/A07: el canje web de una cuenta existente exige su contraseña (Supabase) y después su sesión;
  la action no acepta el rol del cliente y usa el del perfil. Un `user` no conserva cookie de panel.
- A03: zod en la action y en el Core, SQL parametrizado, sin HTML sin escapar; la única inyección
  de HTML es el SVG del QR generado localmente (sin datos del usuario).
- A04: 60/min por IP en la página y 30/min en la action; token de un solo uso en el Core; sin
  redirección automática al abrir la app (sin bucle).
- A05/A10: `qrcode` es local (no hay servicio externo ni `data:`), `public_url` solo desde ajustes,
  destinos de navegación constantes (sin open redirect), token solo en la URL/acción.
- Veredicto: sin hallazgos abiertos. Pendiente la aceptación del propietario en escritorio y
  Android (06 para el formulario de la app y 05 para el App Link https).

**Punto de partida (verificado)**
- La página actual muestra directamente un formulario con email editable; éxito →
  `/login?notice=invitation-redeemed`.
- `/login` sigue en inglés (deuda); la spec propone localizarlo (D7).
- El proxy ya trata `/invite/<token>` como público; `noindex` y `no-referrer` ya están.
- `/download/android` existe y sirve la última release.

**Alcance**
- Dentro:
  - La página resuelve el preview en el servidor (`instant = false`, `await connection()` antes de
    la BD para que el build sin env no la ejecute), aplica 60/min por IP (`invite-page:<ip>`) y
    elige variante Android/iPhone/escritorio.
  - Wizard: aviso literal del propietario, descarga con versión, «abrir en la app» con timeout y
    fallback («si no se abre, usa las opciones de abajo»), «continuar en el navegador» siempre
    visible, QR de escritorio con `qrcode` en **SVG inline sobre tarjeta blanca** (sin `data:` ni
    CSP nueva).
  - El idioma de la página sale del `locale` del preview (el de la invitación), con la cookie como
    fallback.
  - Formulario: datos como ficha (email, nombre, instancia, invitador, caducidad, rol), no inputs
    deshabilitados; contraseña + confirmación o contraseña actual con «¿Olvidaste tu contraseña?»;
    estados de §8.1 y copy accionable.
  - `/welcome` para `user`: «Cuenta creada», descarga, enlace a login y explicación de que el panel
    es solo para administradores.
  - A1 aprobado (D2): server action `submitInvitation` que re-resuelve el preview, **firma
    primero** si la cuenta existe (y no canjea si la contraseña falla), canjea con la sesión; para
    una cuenta nueva canjea y luego firma. No usa el endpoint público (la app sí) y aplica
    `redeem-action:<ip>` 30/min. `user` → `signOut({ scope: "local" })` + `/welcome` (añadirla a
    `public-paths.ts`).
  - i18n de todo; tests de página, wizard, formulario y action.
- Fuera: la app (06); el reset (08); la migración (10); un formulario de canje sin el aviso.

**Dependencias**: 02 (mockup) y 04 (preview/rol/cuenta existente). La UI no empieza sin P2.

**Riesgos**: que el wizard se convierta en una puerta y bloquee el canje (el botón de continuar
siempre visible); que el QR use un servicio externo (se genera en el servidor); que el timeout
redirija en bucle (solo tras clic); que A1 deje una cookie a un `user` sin panel (no se firma para
`user`); que el token quede en el historial (replace).

**Criterios de aceptación**
- Android sin app: aviso, descarga, reintento y «continuar»; el formulario canjea.
- iPhone/escritorio: aviso correcto; escritorio con QR; el canje web funciona.
- Con A1: un admin acaba en `/panel`; un `user` en `/welcome`; sin A1, en `/login` con aviso.
- Cuenta existente: firma antes; una contraseña mala no canjea; una buena canjea con la sesión.
- Sin bucles: el botón de abrir en app no redirige solo; siempre hay salida.
- Formulario bloqueado y confirmación solo en cuenta nueva.
- `pnpm --filter admin build`, `pnpm i18n:check`, tests de web en verde.
- La UI corresponde con el mockup aprobado.

**Puertas de usuario**
- Aprobar el mockup del wizard y del formulario (P2).
- Confirmar A1 (D2) y la localización del login (D7).
- Aceptar el wizard en el preview.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A03, A04, A05, A07, A10):
token en URL, `no-store`, QR sin servicio externo, CSRF de la action, open redirects y
`public_url` para enlaces.
