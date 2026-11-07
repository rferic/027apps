# Spec — Canje público de invitaciones desde el navegador

**Fecha:** 2026-11-07 · **Estado:** Pendiente de aprobación del usuario
**Base:** [API del Core](2026-10-26-core-api.md) (`POST /api/v1/invitations/{token}/redeem`) ·
[web admin](2026-11-06-web-admin-design.md) (patrones de formulario) · [auth](2026-10-25-auth.md) §3 ·
[ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
[ADR 0007](../../adr/0007-manejo-de-errores.md) ·
[i18n](../../flows/i18n.md) (`027_locale`)

## 1. Objetivo

Que una persona invitada pueda aceptar la invitación desde el navegador cuando no tiene la app
Android. Hoy el panel crea y revoca invitaciones y el Core ya implementa el canje (email +
contraseña, single-use, caducidad), pero no existe ninguna superficie pública que lo invoque.

## 2. Alcance

**Dentro**

- Ruta pública `/invite/[token]` sin sesión, fuera del shell del panel.
- Formulario de email, contraseña y confirmación; estados de error y éxito.
- `noindex` y `referrer: no-referrer`.
- Allowlist del proxy ampliada para `/invite/*` sin cargar Supabase.
- Cadenas nuevas en los 9 locales.

**Fuera**

- Contrato de API, casos de uso del Core, modelo de datos, rate limiting.
- Campo de nombre (el Core ya usa el nombre de la invitación).
- Auto-login tras el canje y cualquier sesión en la página.
- Localizar `/login` (deuda existente; el aviso sigue el patrón inglés de esa pantalla).

## 3. Composición

- `apps/admin/src/app/invite/[token]/page.tsx` — server component: `resolveLocale` con la cookie
  `027_locale`, `getDictionary(locale)`, `metadata` con `robots` y `referrer`, y `DocumentLang`.
  No lee sesión ni settings. `export const instant = false` (lee cookies).
- `apps/admin/src/app/invite/[token]/invite-form.tsx` — cliente: primitivas `ui/form.tsx` y
  `ui/button.tsx`; estado de envío y error.
- `apps/admin/src/lib/invite-redeem.ts` — llamada `POST` y lectura del envelope reutilizando
  `failureFrom`/`MutationFailure` de `lib/mutation-result.ts`.
- `apps/admin/src/lib/public-paths.ts` — `isPublicPath` (ayuda exacta + `/invite/<segmento>`).
- `apps/admin/src/proxy.ts` — usa `isPublicPath` para la salida temprana sin Supabase.
- `apps/admin/src/app/(auth)/login/login-form.tsx` — aviso `?notice=invitation-redeemed`.
- `apps/admin/src/components/invitation-create-form.tsx` — el texto de ayuda del token nombra
  también la página web.
- `packages/i18n/catalog.en.json` y `locales/*.json` — cadenas nuevas.

## 4. Flujo

1. El administrador crea la invitación y comparte `https://<instancia>/invite/<token>`.
2. La persona abre el enlace. El locale sale de `027_locale`; el tema, de `027_theme` (layout raíz).
3. Rellena email, contraseña y confirmación. El cliente valida forma y longitudes (12–200) y
   bloquea el doble submit.
4. `POST /api/v1/invitations/{token}/redeem` con `{ email, password }`.
5. Éxito (201): `router.replace("/login?notice=invitation-redeemed")`. `/login` muestra el aviso:
   si la cuenta ya existía, manda la contraseña anterior.
6. Error: se mapea el `code` del envelope a un estado traducido, con `request_id` cuando exista.

## 5. Estados

| Situación | `code` / origen | Resultado |
|---|---|---|
| Forma de token inválida | local (`027_inv_`, ≤200) | enlace no válido, sin petición |
| Desconocida o revocada | `not_found` | enlace no válido (mismo texto) |
| Caducada | `invitation_expired` | caducada; pide otra |
| Usada | `invitation_used` | ya canjeada; enlace a `/login` |
| Contraseña corta / confirmación distinta / email inválido | cliente | inline junto al campo |
| Email distinto al de la invitación | `validation_failed` | revisa el email; no se revela el correcto |
| Cuenta desactivada | `conflict` | contacta con un administrador |
| Cuenta ya registrada y activa | 201 | éxito; el aviso de `/login` cubre la contraseña existente |
| Demasiados intentos | `rate_limited` | espera y reintenta, sin bucle |
| Red / cuerpo no JSON | sin código | alerta genérica y reintento manual |

No se distingue "token desconocido" de "revocado": misma respuesta. La distinción
`invitation_used`/`invitation_expired` es la del contrato aprobado; quien tiene el token ya conoce
su existencia.

## 6. i18n y tema

- El inglés es la clave: literales `t("...")`, nunca texto condicionado por locale.
- Precedencia de locale: cookie `027_locale` → `en`. Sin `?lang` (el enlace lleva el token y no es
  una URL de compartición pública).
- `DocumentLang` fija `document.documentElement.lang`; `<main lang={locale}>` lo hace ya en el
  render inicial.
- Tema: `DocumentTheme` del layout raíz aplica `027_theme`; la página solo usa tokens semánticos
  (`bg-background`, `text-foreground`, `border-border`, `text-destructive`, `text-accent`).
- `pnpm i18n:scan` actualiza el catálogo y `pnpm i18n:check` exige los 9 locales y placeholders
  idénticos.

## 7. Proxy

`isPublicPath` sustituye a `isPublicHelpPath` con dos reglas independientes:

1. Allowlist exacta de ayuda: `/help`, `/help/firebase`.
2. `/invite/<un único segmento>` (barras finales normalizadas).

Las rutas públicas se responden antes de crear el cliente Supabase: `/invite/*` debe renderizar
sin `NEXT_PUBLIC_SUPABASE_*` y conservar el CSP. El `POST` de canje no se ve afectado: sigue
pasando por el proxy normal, con same-origin y rate limit por IP.

## 8. Seguridad

- **Token en la URL**: `router.replace` tras el éxito, `no-referrer`, cero enlaces externos y nunca
  el token en texto, logs de cliente ni storage. `routeOf` del Core ya lo redacta
  (`/:token`); el log de acceso del proxy inverso es un riesgo aceptado (L5, task-08).
- **Contraseñas**: 12–200 caracteres, `autocomplete="new-password"`, solo en memoria, sin auto-login
  (evita fijación de sesión).
- **CSRF**: sin cookie de sesión; el proxy rechaza mutaciones cross-origin a `/api/v1`.
- **Enumeración**: email ligado a la invitación; la respuesta de éxito es idéntica para cuenta
  nueva y existente. No se añaden mensajes que revelen si un email tiene cuenta.
- **Fuerza bruta**: rate limit por IP existente; el cliente no reintenta solo.
- **Superficie**: `noindex`, CSP con `frame-ancestors 'none'`, envelope sin internos (ADR 0007).

## 9. Criterios de aceptación

1. `/invite/<token>` renderiza en `en` y `es` sin sesión ni variables de Supabase.
2. Un canje válido crea/activa la cuenta y deja al usuario en `/login` con el aviso; el token no
   queda en el historial.
3. Cada fila de la tabla de estados produce el texto esperado y ningún estado pinta el `message`
   inglés del servidor.
4. `/invite/a/b`, `/invites/x` y `/help/other` siguen privadas; `/help/firebase` sigue pública.
5. `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm i18n:check` y `pnpm --filter admin build` en verde.
6. Auditoría OWASP sin hallazgos críticos ni altos abiertos.
