---
id: sprint-06-task-07
titulo: Miembros
area: web
estado: finalizada
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: `/members` y `/members/[id]`; editar perfil, cambiar rol con los invariantes existentes y desactivar con confirmación; controles por rol.

**TDD**: listado con filtro, detalle, visibilidad por rol, mutaciones optimistas.

**DoD**: igual, énfasis A01 y A03.

## Informe de auditoría (2026-11-07)

**Veredicto**: aprobada con cambios; todos los hallazgos bloqueantes del lote
remitido quedan corregidos y cubiertos con tests, salvo las desviaciones
aceptadas que se documentan abajo.

| ID | Estado | Corrección |
|---|---|---|
| **H1** | Corregido | `cookieOptions` explícitas (`path: "/"`, `sameSite: "lax"`, `httpOnly: true`, `secure` en producción) en el cliente de `server.ts` y en el del proxy, compartidas desde `lib/supabase/cookie-options.ts`. El comentario que afirmaba que `@supabase/ssr` las añadía por defecto ya no existe. No hay `createBrowserClient` ni lectura de la cookie de sesión desde JavaScript: `HttpOnly` no rompe ningún flujo. Tests: atributos del módulo compartido y de los dos `createServerClient`. |
| **H2** | Corregido | `isSameOriginMutation` en `lib/same-origin.ts`: toda mutación a `/api/v1` con cookie `sb-*` exige `Origin` (o `Referer`) cuyo host coincide con `Host`/`x-forwarded-host`. Sin coincidencia o sin cabecera → `403 {"error":{"code":"forbidden","message":"Cross-origin request rejected"}}` antes de refrescar la sesión. Las llamadas Bearer sin cookie no se ven afectadas. Tests unitarios del helper y del wiring del proxy. |
| **M1** | Desviado | No se instala SWR: las mutaciones de gestión usan `fetch` + `router.refresh()`. SWR/optimistic se reevalúa en task-11 si la UX lo pide. |
| **M2a** | Corregido | El wizard escribe `027_locale` con `localeCookie(form.locale)` tras completar settings + espejo del perfil; test de escritura y de no-escritura si falla el batch. |
| **M2b** | Desviado | Los perfiles nuevos del canje de invitaciones usan `en`/`UTC`; se resuelve en task-08 junto con el caso de uso de invitaciones. |
| **M2c** | Desviado | `enabled_locales` no filtra el selector del panel; se mantiene el catálogo completo de idiomas por decisión de producto. |
| **M2d** | Desviado | Las fechas se formatean sin zona de instancia; se resuelve en task-11 con el ADR 0008. |
| **M3** | Corregido | El formulario de perfil ya no hace `form.reset()`: ante `conflict`/red solo revierte el `<select>` de rol. `validation_failed` pinta `details.fieldErrors` junto a cada campo (`aria-invalid` + `aria-describedby`), y el conflicto de perfil muestra "Your role change conflicts with the instance rules.". `member-mutations.ts` propaga `details` (`fieldErrors`/`formErrors`) sin `any`. |
| **M4** | Corregido | Un 2xx solo es éxito con `204` o cuerpo JSON objeto; `200 text/html`, JSON no objeto o cuerpo vacío devuelven `{ ok: false, requestId }`. Tests con `200 text/html`, array JSON y `204`. |
| **M5** | Corregido + deuda | La consulta a `auth.users` distingue fallo (registro con `logger` sin PII y `emailUnavailable: true`) de sin email (`email: null`). La UI muestra `—` para sin email y "Email unavailable" para el fallo. Mover el email al recurso del Core queda como deuda (ADR 0004 §7). |
| **M6** | Corregido | `/members` solo redirige si `page > pages`; una última página vacía muestra el estado vacío. Tests de `page > pages` y de última página vacía. |
| **M7** | Corregido | El dashboard mapea `installed` a "Installed"; el default sigue siendo "Unknown". Test con `state: "installed"`. |
| **M8** | Corregido | `<html lang="en">` por defecto y `lang={locale}` en el contenedor raíz del shell del panel. `DocumentLang` se mantiene. |
| **M9** | Corregido | El `<dialog>` de desactivación cancela el cierre por Escape mientras hay petición (`onCancel` + `preventDefault`); el botón de cancelar ya estaba deshabilitado. |
| **M10** | Sin cambios | No formaba parte del lote de correcciones remitido a esta sesión. |

**Tests de interacción diferidos**: los de `<dialog>` (Escape) y doble submit
requieren DOM y quedan para task-11, tal como acordó la auditoría. Los tests
nuevos de este lote son de helpers puros y de render estático.

**Verificación (2026-11-07)**:

- `pnpm --filter admin test`: 39 ficheros, 242 tests en verde.
- `pnpm lint`: verde.
- `pnpm tsc`: verde.
- `pnpm i18n:scan` + `pnpm i18n:check`: 222 claves, 9 locales.
- Dev server: `/login` 200; `/` 200 con una sesión real emitida por Supabase (magic link) y panel renderizado; `PATCH /api/v1/users/{id}` con cookie y mismo origen 200; el mismo PATCH con `Origin: https://evil.example` devuelve `403 forbidden`.
