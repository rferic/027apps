---
id: sprint-06-task-12
titulo: Canje público de invitaciones
area: web
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-11-07-invitation-redemption.md
spec: docs/superpowers/specs/2026-11-07-invitation-redemption-design.md
---

**Alcance**: página pública `/invite/[token]` para canjear una invitación desde el navegador.
Hoy las invitaciones se crean y revocan en el panel y existen
`POST /api/v1/invitations/{token}/redeem` (email + contraseña, single-use, caducidad), pero sin
app Android una invitación no se puede aceptar. La página consume ese endpoint ya aprobado: no
añade contrato de API ni toca el Core.

- Ruta `/invite/[token]`, fuera del shell del panel y del grupo `(auth)`, sin sesión: el token es
  la capacidad. El proxy no crea cliente Supabase para esta ruta.
- Server component: locale desde `027_locale` con `resolveLocale` (sin `?lang`: el enlace no es
  una superficie de compartición pública), `DocumentLang` y `lang` en el contenedor. El tema lo
  hereda del layout raíz (`DocumentTheme` lee `027_theme`); no hay selector de tema.
- Formulario cliente con las primitivas `ui/form.tsx` (`FormField`, `FormAlert`, `FormActions`) y
  `ui/button.tsx`: email, contraseña y confirmación. Sin campo de nombre: el Core usa el nombre de
  la invitación (`display_name` es opcional en el contrato).
- Validación de UX en cliente (no sustituye al zod del borde): email requerido, contraseña de
  12–200 caracteres, confirmación idéntica, botón deshabilitado durante el envío (sin doble
  submit). Los límites replican `redeemInvitationSchema` (`packages/core/src/invitations/api.ts`).
- Envío `POST /api/v1/invitations/{token}/redeem` con `credentials: "same-origin"`, JSON
  `{ email, password }` y parseo del envelope ADR 0007 con `lib/mutation-result.ts`. Nada de
  cookies de sesión, `localStorage` ni token en el cuerpo de otros endpoints.
- Éxito (201): `router.replace("/login?notice=invitation-redeemed")`. `replace` saca el token del
  historial del navegador y `/login` muestra el aviso con el patrón de `?error=` que ya usa
  `login-form.tsx`.
- `metadata` con `robots: { index: false, follow: false }` y `referrer: "no-referrer"`; la página
  no enlaza a dominios externos.
- Coherencia con el panel: la ayuda del token
  ("The invitee redeems this token from the mobile app", `invitation-create-form.tsx`) pasa a
  nombrar también la página web; si no, el panel miente sobre el flujo real.

## Estados y copy

| Situación | Origen | Qué ve el usuario |
|---|---|---|
| Token con forma inválida | validación local (prefijo `027_inv_`, ≤200) | "This invitation link is not valid." Sin petición. |
| Token desconocido o revocado | `not_found` (404) | El mismo texto que el anterior: no se distingue "no existe" de "revocada". |
| Invitación caducada | `invitation_expired` (409) | Caducada; pide una nueva al administrador. |
| Invitación ya usada | `invitation_used` (409) | Ya canjeada; enlace a `/login`. |
| Contraseña corta o ausente | cliente y `validation_failed` | Error inline bajo el campo. |
| Confirmación distinta | cliente | Error inline bajo la confirmación. |
| Email distinto al de la invitación | `validation_failed` sin `details` | "El email debe ser el de la invitación"; sin decir cuál es. |
| Cuenta desactivada | `conflict` (409) | Cuenta desactivada; contacta con un administrador. |
| Email ya registrado (cuenta activa) | 201, indistinguible por diseño | Éxito + aviso en `/login`: si ya tenías cuenta, entra con tu contraseña existente. |
| Demasiados intentos | `rate_limited` (429) | Espera un minuto y reintenta. Sin reintento automático. |
| Red caída o cuerpo no JSON | fallo sin código | Alerta genérica + `request_id` si llegó; botón para reintentar. |

## Infra del proxy

- Renombrar `isPublicHelpPath` a `isPublicPath` en `apps/admin/src/lib/public-paths.ts` y
  `apps/admin/src/proxy.ts`, con dos reglas: allowlist exacta de ayuda (`/help`,
  `/help/firebase`) y `/invite/<un segmento>` (normalizando barras finales).
- La ruta pública se resuelve **antes** de crear el cliente Supabase: `/invite/*` debe renderizar
  sin `NEXT_PUBLIC_SUPABASE_*`, igual que la ayuda, conservando el CSP.
- El `POST` a `/api/v1/invitations/{token}/redeem` **no** es una ruta pública del proxy: sigue
  pasando por el chequeo same-origin y por el rate limit por IP de la puerta (30/min por defecto).
- `/invite` no entra en `GATED_PATHS`: la página no depende del estado de instalación.
- Tests negativos obligatorios: `/invite` (sin token), `/invite/a/b`, `/invites/x`, `/help/other`
  y una ruta del panel siguen privadas.

## Seguridad a revisar (auditoría OWASP obligatoria)

- **A01 control de acceso**: el endpoint es público por diseño (`scopes: []`, `auth: anon`); la
  capacidad es el token de un solo uso, ligado a un email, con caducidad y revocación. La página no
  concede sesión: tras canjear se va a `/login`, así que no hay fijación de sesión.
- **A02/A09 token en el path y logs**: el token viaja en la URL de la página y en la del endpoint.
  Mitigaciones: `router.replace` tras el éxito, `referrer: no-referrer`, cero enlaces externos,
  nunca pintar el token como texto, nunca loguearlo (el Core ya lo redacta en `routeOf`,
  `packages/core/src/api/door.ts:86`). El log de acceso del proxy inverso sigue viendo la URL: se
  documenta como riesgo aceptado, igual que L5 de task-08.
- **A03 inyección y validación**: zod en el borde (`redeemInvitationSchema`); la validación de
  cliente es solo UX. Los textos del error se derivan del `code` traducido, nunca del `message`
  inglés del servidor; sin `dangerouslySetInnerHTML`.
- **A04/A09 límites**: rate limit por IP ya existente en la puerta; sin reintentos automáticos en
  el cliente; el formulario no permite bucles de envío.
- **A05 exposición**: la página no necesita Supabase ni secretos; el envelope no filtra internos;
  `request_id` visible para soporte.
- **A07 autenticación y contraseñas**: mínimo 12 caracteres (contrato del Core), `maxLength` 200,
  `autocomplete="new-password"`, contraseña solo en memoria del formulario, nunca en URL, storage
  ni logs. Sin auto-login tras el canje.
- **CSRF**: el formulario no lleva cookie de sesión y la mutación es un `POST` a `/api/v1` que el
  proxy rechaza si es cross-origin (`isSameOriginMutation`). No hay estado de una víctima que
  cambiar; el token es la capacidad.
- **Enumeración de emails**: la invitación está ligada a un email y un email distinto devuelve
  `validation_failed` sin revelar el correcto; el éxito es idéntico para cuenta nueva y existente
  (el Core reutiliza la cuenta y conserva su contraseña, L6 de task-08). No se añade ningún oráculo
  desde la web.
- **Single-use y caducidad**: los garantiza el Core con `for update` y revalidación bajo lock
  (`packages/core/src/invitations/service.ts:311`); la página no los reimplementa.

## TDD

- `public-paths.test.ts`: allowlist de ayuda intacta, `/invite/<token>` pública, negativos de la
  sección de infra.
- `proxy.test.ts`: `/invite/027_inv_…` responde 200 con CSP y **sin** crear cliente Supabase
  (env vacías); una ruta del panel sigue creándolo.
- Página: render con cookie `027_locale` (en y es), `lang` correcto, `metadata.robots` con
  `index: false`, token con forma inválida sin formulario.
- Cliente: contraseña corta, confirmación distinta, email inválido; envío con URL y cuerpo
  correctos; éxito → `replace` a `/login?notice=…`; mapeo de `not_found`,
  `invitation_expired`, `invitation_used`, `conflict`, `validation_failed`, `rate_limited` y fallo
  de red; doble submit bloqueado.
- `/login`: muestra el aviso con `?notice=invitation-redeemed` y no lo muestra sin él.
- `pnpm i18n:scan` + `pnpm i18n:check`: cadenas nuevas en catálogo y en los 8 locales, con
  placeholders idénticos.

## DoD

- DoD de **Código** completo: TDD, `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check &&
  pnpm --filter admin build` en verde, CI del PR, docs/flujos si cambia el comportamiento, ADRs
  0004/0007 respetados, QA de un segundo agente.
- **Auditoría de seguridad OWASP** por un agente distinto del autor, con la checklist de
  `docs/conventions/security-checklist.md`, centrada en A01, A02, A03, A04, A05, A07 y A09 por ser
  superficie pública sin sesión.
- Informe en esta tarea: hallazgos, severidad y resolución; los críticos o altos bloquean
  `finalizada`.

## Notas y dependencias

- La spec de auth (`docs/superpowers/specs/2026-10-25-auth.md` §3) reservaba confirmar email y
  fijar contraseña a la app. Esta página es la superficie web para instancias sin app (decisión del
  usuario, 2026-11-07): el mismo caso de uso, sin cambios de contrato. El PR de implementación
  añade la nota en esa spec; no se crea arquitectura nueva.
- Deuda heredada: el token en el path (L5) y la contraseña ignorada si la cuenta ya existe (L6),
  ambas de task-08.
- `/login` no está traducido (cadenas inglesas literales). El aviso de éxito sigue ese patrón;
  localizar la pantalla de login queda fuera de esta tarea y se anota como deuda.
