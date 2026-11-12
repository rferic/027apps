---
id: sprint-14-task-05
titulo: Apariencia por usuario (tema e idioma en el perfil)
area: producto
estado: finalizada
plan: docs/superpowers/plans/2026-11-11-user-appearance.md
fuente: docs/superpowers/specs/2026-11-11-user-appearance-design.md
adrs: [0002, 0008]
---

**Tarea**: persistir el tema y el idioma en `profiles` para que cada cuenta recupere su
apariencia, usando la cookie solo como pista de carga rápida.

**Punto de partida**: el selector de idioma solo escribe `027_locale` (no actualiza
`profiles.locale`) y el tema solo vive en `027_theme`; en el mismo navegador, otra cuenta
hereda la apariencia anterior.

**Alcance**
- Migración `0021`: `profiles.theme` y permiso de actualización de la columna.
- API: `theme` en `PATCH /users/{id}`.
- Panel: el guard lee `locale` y `theme`; el layout aplica el tema del perfil antes de pintar y
  sincroniza las cookies; los selectores persisten y revierten si el `PATCH` falla.

**Criterios de aceptación** (detalle en la spec §4): dos cuentas en el mismo navegador
conservan su apariencia; sin flash al cambiar de cuenta; el `PATCH` inválido revierte; suite y
CI en verde.

**Riesgos**: un `PATCH` fallido deja la cookie aplicada hasta la recarga (se revierte en la
UI); el script del panel y el del layout raíz deben coincidir en el orden de precedencia.

## Ejecución (2026-11-11)

- Migración `0021` aplicada en local y validada por CI.
- Verificado con un usuario de prueba: perfil `theme=dark`, `locale=ca` y cookies contrarias
  (`light`, `es`). El panel arrancó en oscuro y catalán (la base manda sobre la cookie).
- Al cambiar tema e idioma desde el menú, la base quedó en `light/es` y la interfaz pasó a
  claro y español; el `lang` se actualiza tras el refresco.
- Usuario de prueba eliminado.

## Auditoría (2026-11-12)

Segundo agente: **NO APTO** inicial. Corregido:

- Las 19 páginas de `(panel)` leían `027_locale` de la cookie en vez del locale del perfil y
  mezclaban idiomas tras cambiar de cuenta; ahora usan `gate.user.locale`. `PanelForbidden`
  recibe `userId` y su selector de idioma persiste en el perfil.
- `updateUser` permitía que un `admin`/service key cambiara el `theme` de otro usuario y que una
  clave delegada sin `profile:write` editara el perfil de su dueño. Ahora solo se edita el perfil
  propio con `profile:write`; editar a otro o cambiar `role` exige `users:write`. La ruta
  `PATCH /users/{id}` autentica y delega la autorización al servicio. Tests nuevos para usuario
  propio, usuario ajeno, clave delegada con y sin `profile:write`, y anónimo.
- `profiles.locale` queda limitado en SQL con el `CHECK` de la migración
  `0022_profile_locale_check.sql`, además de la validación de zod y `isSupportedLocale`.
- La reversión optimista de los selectores se extrae a `applyPreference` y se cubre con tests
  (aplica, persiste y revierte si el `PATCH` falla).

Veredicto final: **APTO** tras la corrección; la tarea se cierra con los riesgos residuales
documentados.
