---
id: sprint-16-task-07
titulo: Wizard web, aviso Android 8+ y auto-login A1
area: web
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: convertir `/invite/[token]` en un wizard app-first que no sea una puerta: aviso de que
solo hay app Android (8+), descarga del APK, reintento de apertura sin bucle y canje web completo,
con QR en escritorio y auto-login para roles de panel.

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
    fallback, «continuar en el navegador» siempre visible, QR de escritorio con `qrcode`.
  - Formulario bloqueado (email/nombre) + instancia/invitador/caducidad/rol; contraseña +
    confirmación o contraseña actual; estados de §8.1.
  - A1 (si se aprueba): server action `signInAfterRedeem` que exige que la invitación esté usada por
    ese email y firma con el cliente SSR; `/welcome` para `user` (añadirla a `public-paths.ts`).
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
