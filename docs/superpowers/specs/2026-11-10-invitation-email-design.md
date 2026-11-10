# Spec: invitaciones por email con plantilla reutilizable

- **Fecha:** 2026-11-10
- **Estado:** aprobada por el usuario el 2026-11-10
- **Ámbito:** envío del enlace de invitación por correo (Resend), elección de entrega en el
  alta, plantilla de email reutilizable, idioma por invitación, reenvío y respaldo manual
- **Relacionado:** [`docs/tasks/sprint-13-staging-prod/task-06.md`](../../tasks/sprint-13-staging-prod/task-06.md)
  (cierre: hoy la invitación no envía correo) · [ADR 0002](../../adr/0002-identidad-visual.md) ·
  [ADR 0007](../../adr/0007-manejo-de-errores.md) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) ·
  [`docs/infrastructure.md`](../../infrastructure.md) §Correo transaccional ·
  [`docs/tasks/sprint-14-mejoras/README.md`](../../tasks/sprint-14-mejoras/README.md)

## 1. Objetivo

Que crear una invitación baste para que la persona invitada reciba un correo con su enlace
`/invite/<token>`, en su idioma, con la identidad de la instancia, y que el administrador
pueda elegir entre **enviar por email** o **generar solo el enlace** — sin perder nunca la
invitación si el proveedor falla.

El correo usa una **plantilla reutilizable**, no un HTML suelto, para que resets u otras
comunicaciones futuras compartan estructura y marca.

## 2. No objetivos

- Rediseñar el flujo de redención (`/invite/<token>`, `redeemInvitation`) ni el modelo de
  permisos: el enlace y el token no cambian.
- Enviar correos de Auth (reset, verificación): siguen saliendo por el SMTP de Supabase Auth.
- Webhooks de Resend (bounces, complaints, supresiones) y cola de reintentos asíncrona: se
  anotan como deuda en §14.
- Multi-tenant: la identidad del correo es la de **una** instancia.

## 3. Decisiones cerradas con el propietario (2026-11-10)

| # | Decisión |
|---|---|
| D1 | El **idioma se elige al crear la invitación** (selector con los 9 idiomas soportados; por defecto el de la instancia). |
| D2 | Antes de implementar hay una **fase de diseño de email**: 3 direcciones visuales, mockups HTML + captura PNG, iteración hasta aprobación explícita. |
| D3 | La salida es una **plantilla reutilizable**, no un HTML de un solo uso. |
| D4 | Contenido mínimo: nombre del invitado, quién invita, nombre de la instancia, **logo**, enlace para aceptar y crear la cuenta, **fecha de caducidad explícita** y **aviso de seguridad**. |
| D5 | El alta ofrece **entrega**: *Enviar por email* (por defecto) o *Solo generar enlace*. |
| D6 | Si el envío falla, **la invitación se crea igualmente**; el panel muestra el enlace con botón de copiar y un aviso. |
| D7 | Una invitación pendiente se puede **reenviar** desde su detalle. |

## 4. Arquitectura

### 4.1 Módulo `email` en Core

Nuevo `packages/core/src/email/` (añadir `"./email/*.js": "./src/email/*.ts"` a `exports` de
`packages/core/package.json`):

- `types.ts` — tipos `EmailMessage`, `EmailDelivery`, `EmailLocale`.
- `catalog.ts` — copy del correo en los 9 idiomas (asunto, preheader, saludo, CTA, caducidad,
  aviso de seguridad, pie). No usa el catálogo de UI: el correo tiene su propio contrato y su
  propio check.
- `invitation.ts` — `buildInvitationEmail(input): EmailMessage`. Función **pura**: recibe
  `inviteeName`, `inviterName`, `instanceName`, `publicUrl`, `locale`, `expiresAt`, `token`.
  Devuelve `{ subject, html, text }`. Nada de red, nada de relojes: `expires_at` llega ya
  calculado, así que es determinista y testeable.
- `layout.ts` — envoltorio HTML común (tabla de 600 px, CSS inline, `preheader`, cabecera con
  logo, cuerpo, pie). Es la pieza que reutilizarán futuros correos.
- `check.test.ts` — exige que los 9 idiomas tengan todas las claves y los mismos placeholders.

`packages/core` no gana dependencias: el adapter usa `fetch` nativo.

### 4.2 Adaptador Resend (infra, `apps/admin`)

`apps/admin/src/lib/email/resend.ts` implementa el puerto:

```ts
export interface Mailer {
  send(message: EmailMessage & { to: string; from: { name: string; address: string } }):
    Promise<{ id: string }>;
}
```

- `POST https://api.resend.com/emails` con `Authorization: Bearer ${RESEND_API_KEY}`.
- Timeout duro de 5 s (`AbortSignal.timeout`) y un solo intento: la ruta no debe colgarse.
- Errores mapeados a `email_provider_error`, `email_timeout`, `email_not_configured`,
  `email_missing_public_url`; nunca se propaga el cuerpo crudo del proveedor al cliente.
- `runtime = "nodejs"` en la ruta (igual que el resto).

Variables nuevas (server-only):

| Variable | Obligatoria | Uso |
|---|---|---|
| `RESEND_API_KEY` | sí, para enviar | API key de Resend (free: 100/día). |
| `EMAIL_FROM` | no | Remitente; por defecto `no-reply@mail.ericrf.com`. |
| `EMAIL_FROM_NAME` | no | Nombre visible; por defecto `instance.name`. |

Si falta `RESEND_API_KEY`, la creación funciona y el email se marca `not_configured` (mismo
camino que un fallo). El enlace manual sigue disponible: nunca se bloquea el alta.

### 4.3 Orquestación

El envío ocurre **después** del commit de la invitación, nunca dentro de la transacción:

1. `createInvitation()` (sin cambios de comportamiento) devuelve `{ invitation, token }`.
2. La ruta lee el contexto de instancia (`instance.name`, `instance.public_url`,
   `localization.default_locale`) y el `display_name` del llamante.
3. Si `delivery === "email"`, construye y envía; actualiza `email_sent_at` o
   `email_failed_at` + código.
4. Responde `201` con la invitación, el `token` (solo aquí) y el resultado del email.

Un fallo de envío **no** revierte la invitación ni devuelve 5xx.

## 5. Modelo de datos (migración `0020_invitation_email.sql`)

`public.invitations` gana:

| Columna | Tipo | Notas |
|---|---|---|
| `locale` | `text not null default 'en'` | Idioma elegido en el alta; se fija, no se recalcula al reenviar. |
| `email_sent_at` | `timestamptz null` | Último envío aceptado por Resend. |
| `email_failed_at` | `timestamptz null` | Último intento fallido. |
| `email_error` | `text null` | Código corto (`email_provider_error`, …), nunca el cuerpo del proveedor. |

- `check (locale in ('en','es','ca','it','fr','de','pt','gl','eu'))`.
- Backfill de las invitaciones existentes: `locale` = `localization.default_locale` de
  `public.settings` si existe y es válido; si no, `'en'`.
- Índice parcial `invitations_pending_email` sobre `email_failed_at` para la vista de pendientes
  con fallo (opcional; justificar con `EXPLAIN` si no se usa).
- La sincronización catálogo/seed y el test de migraciones del repo se actualizan como siempre.

## 6. Contrato de API

### 6.1 `POST /api/v1/invitations` (existente, ampliado)

Entrada (`createInvitationSchema`, `.strict()`):

| Campo | Tipo | Regla |
|---|---|---|
| `locale` | enum de 9 | Opcional; por defecto el de la instancia. |
| `delivery` | `"email" \| "link"` | Opcional; por defecto `"email"`. |

Salida `201` (ampliada, compatible):

```json
{
  "invitation": { "...": "...", "locale": "es", "email_sent_at": "…", "email_failed_at": null },
  "token": "027_inv_…",
  "email": { "status": "sent|failed|skipped", "code": "email_provider_error" }
}
```

- `skipped` = `delivery: "link"` o `RESEND_API_KEY` ausente (con `code: "not_configured"`).
- `token` sigue devolviéndose **una sola vez**; el cliente decide si lo muestra.

### 6.2 `POST /api/v1/invitations/:id/resend-email` (nuevo)

- Scope `invitations:write`; rate limit de escritura + **cooldown de 60 s por invitación**
  (protege la cuota de 100/día) → `429` con `retry_after`.
- Rechaza `used` (`409 invitation_used`), `revoked`/inexistente (`404`), `expired`
  (`409 invitation_expired`): reenviar un enlace caducado solo genera frustración.
- Genera un token nuevo (rota el anterior) y actualiza `email_sent_at`. **No** cambia
  `expires_at` ni el idioma.
- Responde `{ token, email: { status, code } }` para que el panel pueda ofrecer el enlace si
  el reenvío falla.

`packages/core/src/openapi/registry.ts` documenta ambos cambios y `generate.test.ts` los cubre.

## 7. Plantilla de correo

Estructura (una columna, 600 px, fondo neutro, tarjeta blanca):

1. **Preheader** oculto: «{instancia} te ha invitado».
2. **Cabecera**: logo de la instancia (`{public_url}/icon.png`, 48 px de alto, `alt` con el
   nombre) + nombre de la instancia.
3. **Saludo**: «Hola, {name}».
4. **Quién invita**: «{inviter} te ha invitado a unirte a {instancia}».
5. **CTA**: botón «Aceptar invitación» → `{public_url}/invite/<token>`.
6. **Enlace de respaldo** en texto plano (clientes que bloquean botones).
7. **Caducidad**: «Este enlace caduca el {fecha}» con fecha larga localizada según el idioma
   del correo (ADR 0008: `Intl.DateTimeFormat`, sin fechas a mano).
8. **Aviso de seguridad**: «Si no esperabas esta invitación, ignora este mensaje. El enlace
   caduca solo y no da acceso a nadie más».
9. **Pie**: nombre de la instancia + `public_url`; sin píxeles de seguimiento ni analytics.

Reglas técnicas:

- HTML de email: tablas, CSS inline, sin `flex`/`grid`, sin JS, ancho máximo 600 px.
- Modo oscuro: `prefers-color-scheme` con `bgcolor` de respaldo; contraste AA en ambos.
- `text/plain` generado del mismo modelo (no se escribe a mano).
- Asunto ≤ 60 caracteres, sin CR/LF (anti-inyección de cabeceras) y con el nombre de la
  instancia.
- Todos los valores interpolados se escapan (`&`, `<`, `>`, `"`, `'`); el asunto se sanitiza
  aparte.
- El logo es una URL absoluta a un recurso propio: no se incrusta SVG (Outlook no lo pinta) ni
  se usa una imagen externa de terceros.

### 7.1 Fase de diseño (DoD Diseño)

1. Tres direcciones visuales en `docs/mockups/email/invitation/v1..v3.html` con capturas
   `v1..v3.png`, construidas con los tokens de marca y datos de ejemplo ficticios.
2. El propietario elige y pide cambios; se itera hasta aprobación explícita en la sesión/PR.
3. La dirección aprobada se convierte en `layout.ts` + `invitation.ts`; no se mantiene HTML
   duplicado. Los mockups quedan como referencia histórica.
4. Solo entonces empieza la implementación (TDD).

## 8. Panel

- **Alta** (`invitation-create-form.tsx`): selector *Entrega* (Email / Solo enlace) y selector
  *Idioma* (9, por defecto el de la instancia). Si es *Solo enlace*, la respuesta muestra el
  token con el panel actual de copiar.
- **Resultado**: si el email se envió, «Correo enviado a {email}» y el enlace igualmente
  disponible (respaldo). Si falló, aviso no bloqueante + enlace.
- **Detalle** (`invitations/[id]`): estado del email (enviado / fallido / sin enviar) y acción
  *Reenviar email* para invitaciones pendientes, con feedback y manejo de `429`.
- Textos nuevos al catálogo y a los 9 idiomas; sin colores fuera de tokens; foco visible y
  `aria-live` en el resultado.

## 9. Seguridad (OWASP)

| Riesgo | Control |
|---|---|
| A01 — crear/reenviar sin permiso | Scope `invitations:write` en ambas rutas; el reenvío solo actúa sobre invitaciones existentes. |
| A02 — fuga del token | El token no se registra en logs, Sentry ni eventos realtime; solo viaja en la respuesta de creación/reenvío y en el enlace. Referrer `no-referrer` ya vigente en `/invite/:token`. |
| A03 — inyección en el correo | Escapado de todo valor interpolado; asunto sin CR/LF; nada de HTML del usuario. |
| A04 — abuso de la cuota / relay | Destinatario **siempre** el email de la invitación (nunca uno del request); cooldown 60 s + rate limit; sin endpoint genérico de envío. |
| A05 — secreto | `RESEND_API_KEY` solo en servidor; nunca `NEXT_PUBLIC_*`; no aparece en logs. |
| A07 — enlace eterno | El reenvío rota el token; caducidad intacta; revocación sigue vigente. |
| A09 — fallos silenciosos | Códigos de error acotados, `email_failed_at`, log con `invitation_id` (sin email) y alerta Sentry en fallo del proveedor. |
| Cadena de suministro | Sin SDK nuevo: `fetch` nativo. Si se añadiera el SDK de Resend, se justifica y se fija versión. |
| Host del enlace | `instance.public_url` (setting), nunca la cabecera `Host` del request. |

## 10. i18n

- Copy del correo en `packages/core/src/email/catalog.ts` (9 idiomas) con test de paridad y de
  placeholders.
- La fecha se formatea con el locale del correo y la zona de `localization.timezone`.
- Textos de panel al catálogo de UI (`packages/i18n/catalog.en.json` + 8 locales) vía
  `pnpm i18n:scan` y traducción.

## 11. Observabilidad

- Log estructurado por envío: `invitation_id`, `locale`, `status`, `code`, `duration_ms`.
  Nunca el email ni el token.
- Sentry: solo en `status=failed`, con tag `code`.
- Evento realtime `invitation.created` gana `email_status` (informativo para el panel abierto).
- La tasa de fallo se puede ver en Vercel Runtime Logs filtrando `msg:"invitation.email"`.

## 12. Criterios de aceptación

1. Crear una invitación con *Email* en producción envía un correo real a una dirección de
   prueba, con el enlace funcionando de punta a punta (abrir → elegir contraseña → entrar).
2. Crear con *Solo enlace* no envía correo y devuelve `email.status = "skipped"`.
3. Con `RESEND_API_KEY` inválida o proveedor caído: `201`, invitación válida,
   `email.status = "failed"`, enlace visible y copiable; existe fila con `email_failed_at`.
4. *Reenviar* sobre una pendiente envía y rota el token (el anterior deja de redimir); sobre
   usada/caducada/revocada devuelve el error documentado; dos reenvíos seguidos → `429`.
5. Los 9 idiomas generan asunto, HTML y texto sin placeholders sin sustituir y sin fechas en
   inglés cuando el locale no lo es.
6. No aparece ningún token ni dirección de correo en logs, Sentry ni eventos.
7. `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build` en verde; CI del PR en
   verde; migración `0020` aplicada en dev y en prod con `supabase db push`.
8. Mockup aprobado por el propietario antes de la implementación (evidencia en el PR).

## 13. Puertas de usuario

1. Crear una API key en Resend con permiso de envío y cargarla como `RESEND_API_KEY` en Vercel
   (Production, Preview y Development). **No** se reutiliza la contraseña SMTP de Supabase Auth
   como API key: son credenciales distintas.
2. Confirmar que `mail.ericrf.com` sigue verificado en Resend (SPF/DKIM/DMARC) y que el
   remitente `no-reply@mail.ericrf.com` está permitido.
3. Facilitar una dirección de prueba para la verificación end-to-end.

## 14. Riesgos y deuda

| Riesgo | Mitigación |
|---|---|
| Cuota Resend 100/día | Cooldown, rate limit y enlace manual como respaldo. |
| Correo en spam | Dominio ya verificado; HTML sobrio sin imágenes pesadas; texto plano alternativo. Se revisa en Gmail/Outlook/Apple Mail. |
| Fallo del proveedor durante el alta | No bloquea: invitación creada + enlace. |
| `icon.png` no es el logo de cada instancia | Hoy no hay setting de logo (se retiró en `0017`). El logo del correo es el icono de la app servido por la instancia; si vuelve `instance.logo_url`, la plantilla lo lee. |
| Deuda | Webhooks de Resend (bounce/complaint), reintentos con backoff, y plantilla para resets si se decide moverlos fuera de Supabase Auth. |

## 15. Pruebas (TDD)

- `email/check.test.ts`: paridad de claves y placeholders en 9 idiomas.
- `email/invitation.test.ts`: escapado, asunto sin CR/LF, fecha localizada, enlace correcto,
  texto plano coherente.
- `invitations/service.test.ts`: `locale` y `delivery` persistidos; reenvío rota token, no
  toca `expires_at`; cooldown.
- `invitations/api.test.ts`: esquema estricto, `201` con `email.status`, `429`, `409`, `404`,
  scope requerido.
- `resend.test.ts`: timeout, mapeo de errores, no filtra el cuerpo del proveedor.
- `invitation-mutations.test.ts` / `page.test.tsx`: selector de entrega e idioma, aviso de
  fallo, botón de reenvío.
- Migración: test de sincronización catálogo/seed y `db-tests` si aplica.

## 16. ADRs aplicables

`0002` (identidad visual), `0004` (bordes y capa de aplicación), `0007` (errores),
`0008` (fechas y moneda). No se requiere ADR nuevo.
