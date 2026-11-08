# Plan — Canje público de invitaciones

> **Para agentes:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans`. Pasos en checkbox (`- [ ]`).

**Objetivo:** añadir `/invite/[token]`, una página pública sin sesión que canjea una invitación
con email y contraseña llamando al endpoint ya existente, y que deja al usuario en `/login` con un
aviso.

**Arquitectura:** página server component (locale por cookie, sin Supabase) + formulario cliente
que llama `POST /api/v1/invitations/{token}/redeem` y lee el envelope ADR 0007. El proxy no crea
cliente Supabase para `/invite/*`. Sin cambios en el Core, en el contrato de API ni en el modelo
de datos.

**Stack:** Next.js 16 App Router (Cache Components), React 19, TypeScript, Vitest (`environment:
node`, `renderToStaticMarkup`, sin DOM), `@027apps/i18n`, Tailwind con tokens semánticos.

**Spec:** `docs/superpowers/specs/2026-11-07-invitation-redemption-design.md`

## Restricciones globales

- Código, comentarios, commits y ramas en **inglés**; docs internas y conversación en **español**.
- El inglés es la clave de i18n: cada cadena traducible es un literal `t("...")`; los 9 locales
  deben quedar completos y con los mismos `{placeholders}` (`pnpm i18n:check`).
- Solo tokens semánticos de color (`bg-background`, `text-foreground`, `border-border`,
  `text-destructive`, `text-accent`). Sin `any`, sin `console.log`, sin código comentado.
- No tocar `packages/core` ni `packages/db-tests`: el canje ya está implementado y probado.
- Antes de declarar terminado: `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm i18n:check` y
  `pnpm --filter admin build`.
- Leer `apps/admin/AGENTS.md` y la guía correspondiente de `apps/admin/node_modules/next/dist/docs/`
  antes de escribir la página (App Router, `metadata`, `params` como `Promise`, `instant = false`).
- La rama es `sprint/06-web`; no se commitea ni se mergea sin orden explícita del usuario.

## Revisión focalizada

- **Token fuera del historial:** el éxito usa `replace`, no `push`; el enlace no aparece al volver
  atrás. Nada de token en `localStorage`, cookies ni logs.
- **Sin oráculo:** un token desconocido y uno revocado dan el mismo texto; el email distinto no
  revela el correcto; el éxito es idéntico para cuenta nueva y existente.
- **Página sin Supabase:** `/invite/<token>` responde 200 con `NEXT_PUBLIC_SUPABASE_*` vacías y
  conserva el CSP; `/invite/a/b` no es pública.
- **Nada de mensajes del servidor en pantalla:** se pinta el texto traducido del `code`, nunca
  `error.message` (inglés técnico, ADR 0007).
- **Límites del Contrato:** contraseña 12–200 (no más reglas de las que aplica el Core) y sin
  campo de nombre.

## Estructura de ficheros

**Proxy y utilidades**
- Modificar `apps/admin/src/lib/public-paths.ts` — `isPublicPath` con ayuda exacta + `/invite/<x>`.
- Modificar `apps/admin/src/lib/public-paths.test.ts` — positivos y negativos.
- Modificar `apps/admin/src/proxy.ts` — importar `isPublicPath`.
- Modificar `apps/admin/src/proxy.test.ts` — `/invite/<token>` sin cliente Supabase.
- Crear `apps/admin/src/lib/invite-redeem.ts` — `POST` + envelope.
- Crear `apps/admin/src/lib/invite-redeem.test.ts` — fetcher inyectado.
- Crear `apps/admin/src/lib/invite-form.ts` — validación de forma pura.
- Crear `apps/admin/src/lib/invite-form.test.ts`.
- Crear `apps/admin/src/lib/invite-errors.ts` — `code` → titular traducido.
- Crear `apps/admin/src/lib/invite-errors.test.ts`.

**Página**
- Crear `apps/admin/src/app/invite/[token]/page.tsx`.
- Crear `apps/admin/src/app/invite/[token]/page.test.tsx`.
- Crear `apps/admin/src/app/invite/[token]/invite-form.tsx`.
- Crear `apps/admin/src/app/invite/[token]/invite-form.test.tsx`.

**Login y panel**
- Modificar `apps/admin/src/app/(auth)/login/login-form.tsx` — aviso por `?notice=`.
- Crear `apps/admin/src/app/(auth)/login/login-form.test.tsx` (no existe hoy).
- Modificar `apps/admin/src/components/invitation-create-form.tsx` — el texto del token nombra la
  página web.

**i18n y docs**
- Modificar `packages/i18n/catalog.en.json` y `packages/i18n/locales/*.json` (8) vía
  `pnpm i18n:scan` + traducción.
- Modificar `docs/superpowers/specs/2026-10-25-auth.md` §3 — nota de la superficie web (solo el PR
  de implementación).
- Actualizar `docs/tasks/sprint-06-web/task-12.md` con el informe de implementación.

---

### Tarea 1: Allowlist del proxy

**Ficheros:**
- Modificar `apps/admin/src/lib/public-paths.ts`, `apps/admin/src/lib/public-paths.test.ts`
- Modificar `apps/admin/src/proxy.ts`, `apps/admin/src/proxy.test.ts`

**Interfaces:**
- Produce: `isPublicPath(pathname: string): boolean`
- Consume: `isPublicHelpPath` se elimina; no quedan referencias.

- [ ] **Paso 1: Escribir los tests que fallan** en `public-paths.test.ts`

Positivos: `/help`, `/help/firebase`, `/help/firebase/`, `/invite/027_inv_abc123`,
`/invite/027_inv_abc123/`. Negativos: `/`, `/setup`, `/login`, `/helpful`, `/help/other`,
`/help/firebase/secret`, `/invite`, `/invite/`, `/invite/a/b`, `/invites/x`, `/invite/../members`.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/lib/public-paths.test.ts`

- [ ] **Paso 3: Implementar `isPublicPath`**

Normalizar barras finales una sola vez. Ayuda: `Set` exacto. Invitación: expresión que exija
`/invite/` + exactamente un segmento no vacío. Comentar por qué la ayuda es allowlist exacta y la
invitación un patrón (el token es dinámico).

- [ ] **Paso 4: Ejecutar y ver el verde**

`pnpm --filter admin exec vitest run src/lib/public-paths.test.ts`

- [ ] **Paso 5: Test del proxy que falla**

En `proxy.test.ts`, añadir un caso con `NEXT_PUBLIC_SUPABASE_*` vacías: `GET
http://localhost/invite/027_inv_abc` responde 200, lleva
`content-security-policy-report-only` y `createServerClient` **no** se llama. Añadir el negativo
`/invite/a/b` (sí intenta crear cliente / no trata la ruta como pública).

- [ ] **Paso 6: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/proxy.test.ts`

- [ ] **Paso 7: Cambiar el import en `proxy.ts` y ver el verde**

`isPublicHelpPath` → `isPublicPath`. Mismo punto de salida temprana, antes de `sessionClient`.
Ejecutar el test del paso 6.

---

### Tarea 2: Cliente de canje y validación de forma

**Ficheros:**
- Crear `apps/admin/src/lib/invite-redeem.ts`, `apps/admin/src/lib/invite-redeem.test.ts`
- Crear `apps/admin/src/lib/invite-form.ts`, `apps/admin/src/lib/invite-form.test.ts`
- Crear `apps/admin/src/lib/invite-errors.ts`, `apps/admin/src/lib/invite-errors.test.ts`

**Interfaces:**
- Produce: `redeemInvitation(input: { token: string; email: string; password: string }, fetcher?: typeof fetch): Promise<MutationResult>`
- Produce: `validateInviteForm(input: { email: string; password: string; confirmation: string }): Record<string, string[]>`
- Produce: `inviteErrorHeading(error: MutationFailure | null, messages: TranslationMap): string`
- Consume: `MutationFailure`/`MutationResult`/`failureFrom`/`withoutBody` de `lib/mutation-result.ts`.

- [ ] **Paso 1: Tests que fallan de `validateInviteForm`**

Casos: válido → `{}`; email vacío → `email`; contraseña de 11 → `password`; de 201 → `password`;
confirmación distinta → `confirmation`; contraseña de 12 exactos → válido. Mensajes como claves
inglesas completas (se pintan tal cual, sin `t()` en la lib de validación).

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/lib/invite-form.test.ts`

- [ ] **Paso 3: Implementar la validación pura**

Trim del email; comparar `password` con `confirmation`; devolver solo los campos con error.
Constantes `MIN_PASSWORD = 12` y `MAX_PASSWORD = 200` exportadas para el `minLength`/`maxLength`
del formulario.

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

- [ ] **Paso 5: Tests que fallan de `redeemInvitation`**

Con un `fetcher` inyectado: URL `/api/v1/invitations/${encodeURIComponent(token)}/redeem`,
`method: "POST"`, `credentials: "same-origin"`, `content-type: application/json`, cuerpo
`{ email, password }` y **sin** nombre. 201 con JSON → `{ ok: true }`. 204 → `{ ok: true }`. 409
con envelope `invitation_used` → `code` y `request_id` presentes. 404 → `not_found`. 429 →
`rate_limited`. 2xx con HTML (proxy) → `{ ok: false }` sin código. `fetch` que lanza → `{ ok: false }`.
El token no debe aparecer en el cuerpo.

- [ ] **Paso 6: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/lib/invite-redeem.test.ts`

- [ ] **Paso 7: Implementar `redeemInvitation`**

Reutilizar `failureFrom` y `withoutBody`; éxito solo con 201/204 y JSON objeto (mismo criterio que
`readMutation`). Sin `console.log`, sin reintentos.

- [ ] **Paso 8: Ejecutar y ver el verde**

Mismo comando del paso 6.

- [ ] **Paso 9: Tests que fallan de `inviteErrorHeading`**

Cada código con su titular: `not_found` → "This invitation link is not valid.";
`invitation_expired` → caducada; `invitation_used` → ya canjeada; `conflict` → cuenta desactivada;
`validation_failed` → revisa el email; `rate_limited` → espera y reintenta; desconocido/null →
"we couldn't redeem". Comprobar que el español aparece con un mapa traducido.

- [ ] **Paso 10: Implementar con literales `t("...")`**

Un `switch` que devuelva `t("…", messages)`. Nada de `messages[code]` ni de concatenar: el
scanner solo ve literales.

- [ ] **Paso 11: Ejecutar los tres ficheros y ver el verde**

`pnpm --filter admin exec vitest run src/lib/invite-form.test.ts src/lib/invite-redeem.test.ts src/lib/invite-errors.test.ts`

---

### Tarea 3: Página pública

**Ficheros:**
- Crear `apps/admin/src/app/invite/[token]/page.tsx`
- Crear `apps/admin/src/app/invite/[token]/page.test.tsx`

**Interfaces:**
- Produce: `default async function InvitePage({ params }: { params: Promise<{ token: string }> })`
- Produce: `export const metadata: Metadata`
- Consume: `resolveLocale`, `LOCALE_COOKIE`, `getDictionary`, `DocumentLang`, `BrandLogo`,
  `InviteForm`.

- [ ] **Paso 1: Test que falla** con `next/headers` mockeado (patrón de
  `app/help/firebase/page.test.tsx`)

Casos: cookie `es` → `lang="es"` y textos en español; sin cookie → `en`; `metadata.robots` es
`{ index: false, follow: false }` y `metadata.referrer === "no-referrer"`; token sin prefijo
`027_inv_` o de más de 200 caracteres → no renderiza `<form>` y muestra el estado no válido; token
válido → renderiza el formulario con los tres campos.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/app/invite`

- [ ] **Paso 3: Implementar la página**

`export const instant = false`; leer `cookies()`; `resolveLocale({ cookie })`; `getDictionary`;
`<main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">` con
`BrandLogo`, `h1`, párrafo y el formulario; `<DocumentLang locale={locale} />` al final. Validar
la forma del token con la misma regla que el Core (prefijo `027_inv_`, ≤200) antes de renderizar el
formulario. `metadata` con `title` de la marca, `robots` y `referrer`.

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

---

### Tarea 4: Formulario y estados

**Ficheros:**
- Crear `apps/admin/src/app/invite/[token]/invite-form.tsx`
- Crear `apps/admin/src/app/invite/[token]/invite-form.test.tsx`

**Interfaces:**
- Produce: `InviteForm({ token, messages }: { token: string; messages: TranslationMap })`
- Consume: `validateInviteForm`, `redeemInvitation`, `inviteErrorHeading`, `FormField`,
  `FormAlert`, `FormActions`, `Button`, `useRouter`.

- [ ] **Paso 1: Test de render estático que falla**

Sin DOM disponible: comprobar estructura y accesibilidad. Tres controles con `<label for>`, tipos
`email`/`password`, `autocomplete` (`email`, `new-password`, `new-password`), `minlength="12"` y
`maxlength="200"`, sin campo `name`, botón "Accept invitation", enlace a `/login` como salida. Con
`error` inyectado, el titular correcto aparece en un `role="alert"` y **no** aparece el `message`
inglés crudo del servidor.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/app/invite`

- [ ] **Paso 3: Implementar el formulario**

`"use client"`; estado `submitting`, `failure`, `fieldErrors`. Al enviar: `preventDefault`,
validar con `validateInviteForm`; si hay errores, pintarlos inline sin llamar; si no, `redeemInvitation`.
`ok` → `router.replace("/login?notice=invitation-redeemed")`. Fallo → `inviteErrorHeading` +
`FormAlert` con `code` y `requestId` (sin `details` del servidor salvo `fieldErrors` de zod, que se
pintan junto al campo). Botón `disabled={submitting}`. Nada de auto-foco ni spinner de página
completa.

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

---

### Tarea 5: Aviso en `/login`

**Ficheros:**
- Modificar `apps/admin/src/app/(auth)/login/login-form.tsx`
- Crear `apps/admin/src/app/(auth)/login/login-form.test.tsx`

**Interfaces:**
- Consume: `useSearchParams`, patrón existente de `?error=`.
- Produce: aviso `?notice=invitation-redeemed`.

- [ ] **Paso 1: Test que falla**

Con `next/navigation` mockeado (patrón de `page.test.tsx`): `?notice=invitation-redeemed` pinta el
aviso; sin el parámetro no; `?error=invalid_credentials` sigue funcionando y ambos pueden convivir
sin romper el formulario.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run login-form`

- [ ] **Paso 3: Implementar**

`notice` como texto inglés literal (esa pantalla aún no está localizada; se anota la deuda en
task-12). Copia: "Invitation accepted. Sign in with your email and password. If you already had an
account, use your existing password." Estilo `text-xs text-muted-foreground`, sin `role="alert"`
(es un éxito, no un error); no tocar el flujo de `signInAction`.

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

---

### Tarea 6: Coherencia del panel y traducciones

**Ficheros:**
- Modificar `apps/admin/src/components/invitation-create-form.tsx`
- Modificar `packages/i18n/catalog.en.json`, `packages/i18n/locales/*.json`

- [ ] **Paso 1: Actualizar el texto de ayuda del token**

Sustituir "The invitee redeems this token from the mobile app to join the instance." por un texto
que nombre la página web y la app. Mantener el literal `t()`; el test actual no afirma ese texto,
así que añadir la aserción del texto nuevo en `invitation-create-form.test.tsx`.

- [ ] **Paso 2: Ejecutar el test afectado**

`pnpm --filter admin exec vitest run invitations`

- [ ] **Paso 3: Escanear y traducir**

`pnpm i18n:scan` (el `mergeCatalog` conserva las claves anteriores y añade los literales nuevos;
la clave del texto sustituido se queda como peso muerto, igual que el resto de cadenas
pre-sembradas). Traducir las claves nuevas en los 8 locales no ingleses conservando los
`{placeholders}` exactos y sin tocar el inglés.

- [ ] **Paso 4: Verificar i18n**

`pnpm i18n:check` → 9 locales completos, sin sobrantes ni placeholders distintos.

---

### Tarea 7: Gates, informe y auditoría

- [ ] **Paso 1: Ejecutar los gates y leer la salida**

```
pnpm lint
pnpm tsc
pnpm test
pnpm i18n:check
pnpm --filter admin build
```

- [ ] **Paso 2: Comprobar la página sin Supabase**

Con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías, `pnpm --filter admin dev`
y abrir `/invite/027_inv_prueba`: 200, sin errores de Supabase, CSP presente, formulario visible.
Probar `/invite/a/b` y confirmar que no es pública.

- [ ] **Paso 3: Nota en la spec de auth**

Añadir en `docs/superpowers/specs/2026-10-25-auth.md` §3 que el canje también puede hacerse desde
la web cuando no hay app, con el mismo caso de uso y sin cambios de contrato.

- [ ] **Paso 4: Informe de implementación en task-12**

Alcance entregado, verificación con números de tests, deuda (login sin i18n, token en el path) y
respuestas a §10 de la UX review solo en lo que aplique (procedencia del dato y estados; las
acciones sobre uno mismo no existen en una superficie anónima).

- [ ] **Paso 5: Auditoría**

Un agente distinto revisa QA + OWASP (A01, A02, A03, A04, A05, A07, A09) y deja el informe en
task-12. Los hallazgos críticos o altos sin resolver bloquean `finalizada`.
