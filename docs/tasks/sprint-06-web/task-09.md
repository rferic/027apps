---
id: sprint-06-task-09
titulo: Claves API + ajustes
area: web
estado: finalizada
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: `/keys` (secreto una sola vez, revocar, uso super_admin) y `/settings` (categorías, `is_secret → configured`, batch write de task-04, `security.*`/`public_url`/CORS super_admin, monedas).

**TDD**: listar/crear/revocar, copia única, enmascarado, batch, visibilidad.

**DoD**: igual, énfasis A05 y A01.

## Informe de auditoría (2026-11-06)

**Veredicto**: aprobado en seguridad (sin hallazgos críticos ni altos). Se
corrigen F1, F2, F4 y F7; F3, F5, F6 y F8 se rechazan con el motivo escrito.

| ID | Estado | Resolución |
|---|---|---|
| **F1** | Corregido | `panel-keys.ts` expone `owner` (nombre del perfil para una delegada, "Instance" para una `service`), `roleCap` y `expiresAt`. `/keys` muestra el propietario, el badge del cap cuando existe y la caducidad (`Never` si es null). La confirmación de revocación nombra al propietario ("This key belongs to Sara.") o indica "This is an instance key.". Tests: `service` con cap `super_admin` muestra cap e "Instance"; una delegada muestra el nombre del dueño. |
| **F2** | Corregido | El formulario filtra los ámbitos ofrecidos con `allowedApiKeyScopes` de `api-key-scopes.ts`: `service` + `admin` no ofrece `maintenance:run` ni `users:deactivate`; `service` + `super_admin` sí; una delegada nunca ofrece los de super_admin ni `maintenance:run`. El texto engañoso pasa a "Scopes are limited by the key kind and role cap.". El listado etiqueta la columna como "Requested scopes". Tests de las tres combinaciones. |
| **F3** | Rechazado (deuda) | No existe `admin_actions`: es una carencia pre-existente del Core y no la introduce task-09. Queda como deuda para cuando exista la tabla. |
| **F4** | Corregido | `docs/flows/i18n.md` documenta que cambiar `localization.default_locale` en `/settings` no reescribe la cookie `027_locale` ni el panel del usuario actual: solo afecta a perfiles nuevos (canje de invitación) y a clientes que lean `settings_public`; los perfiles existentes conservan su preferencia. |
| **F5** | Rechazado (deuda) | El envelope de errores no expone códigos por campo; mapear los mensajes zod en inglés requiere cambiar el contrato del Core. Fuera del alcance de task-09. |
| **F6** | Rechazado (deuda) | a11y de los errores inline y del duplicado: pulido de UI que se aborda en task-11. |
| **F7** | Corregido | Los campos de secreto (textarea JSON y password) usan `autoComplete="off"` para que el gestor de contraseñas no guarde el JSON de FCM. Test de render. |
| **F8** | Rechazado (deuda) | Restos de mantenibilidad (`readOnlyKeys` muerto, enums): pulido posterior; no afectan al comportamiento ni a la seguridad. |

**Verificación (2026-11-06)**:

- `pnpm --filter admin test`: 59 ficheros, 393 tests en verde.
- `pnpm lint`: verde.
- `pnpm tsc`: verde.
- `pnpm i18n:scan` + `pnpm i18n:check`: 361 claves, 9 locales, en verde.
- No se ejecutó `next build` ni se usó la sesión real del usuario.
