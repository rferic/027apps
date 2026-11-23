---
id: sprint-17-panel-y-notificaciones
titulo: Importador seguro, notificaciones por móvil y liquidaciones editables
area: producto
estado: aprobada 2026-11-23 · en curso (tarea 01)
---

# Sprint 17 — Importador seguro, notificaciones por móvil y liquidaciones editables

> **Reescrito el 2026-11-23.** Este directorio conserva el slug histórico. El plan nació como
> sprint 16, se conservó como 17 cuando el flujo de invitación tomó el 16 y el sprint 18 se le
> adelantó. Su contenido original está en el historial de git
> (`git log --follow docs/tasks/sprint-17-panel-y-notificaciones/README.md`); lo de abajo lo
> sustituye.

**Origen:** re-auditoría del 2026-11-23 contra el código. El plan anterior (2026-11-16) copiaba el
backlog sin comprobarlo: su primera tarea ya estaba hecha y la segunda describía el fallo en el
sitio equivocado. Este documento es la spec del sprint; los planes con pasos exactos se escriben al
arrancar cada tarea y viven en `docs/superpowers/plans/`.

## Qué se arregla

| Hoy | Después |
|---|---|
| Dos importaciones del mismo grupo a la vez pueden **duplicar los gastos**: la comprobación de filas se lee antes del candado (`importer.ts:251` frente a `:262`) | La comprobación y la escritura van dentro del mismo candado; el import es atómico y repetirlo no duplica nada |
| Elegir un nombre en el mapeo de la app crea el miembro al momento; cancelar lo deja creado | Los miembros se crean dentro de la transacción del commit; cancelar no toca el grupo |
| Las notificaciones solo se silencian desde los ajustes de Android | Preferencias **por móvil**: maestro, generales y módulos, y el servidor deja de enviar lo que no quieres |
| Tocar un pago abre el formulario de gasto y el servidor lo rechaza | Un pago se corrige en su propio formulario |
| El commit del import no cumple la idempotencia que la spec promete (`2026-11-13-owe-no.md:470`) | Un reintento exacto devuelve el mismo resultado, sin una segunda línea en el historial |
| El panel no dice si un usuario recibe notificaciones | La ficha lo dice |

## Decisiones del propietario (2026-11-23)

Notificaciones:

1. Si Android deniega el permiso, el interruptor se ve **apagado y bloqueado**; al tocarlo se vuelve
   a pedir el permiso. La app no dice «Listo» si no lo está.
2. **Primero el maestro; después las generales; después los módulos** en desplegable, cada uno con
   un switch que marca o desmarca todas sus casillas.
3. Cada módulo lleva **su logo y su nombre** en la cabecera. Las generales no llevan logo: no hay
   módulo al que ponerle cara.
4. Cuatro casillas: gasto nuevo, gasto corregido o borrado, solicitud de plazas y respuesta a tu
   solicitud. Los módulos que no envían avisos no aparecen.
5. La preferencia es **de este móvil**, no de la cuenta.
6. Un módulo a medias se lee «1 de 2»; el switch de cabecera no finge que está todo encendido.
7. En la ficha del panel basta con el maestro: «Notificaciones: activas / desactivadas».

Importación: un reintento exacto devuelve **el mismo resultado** (opción A), no una segunda línea
en el historial.

## Alcance: cinco tareas

| # | Tarea | Área |
|---|---|---|
| 01 | **Import atómico y candado de duplicados** | core + web + app |
| 02 | **Preferencias de notificación por móvil** (maestro, generales y módulos) | core + app + SQL |
| 03 | **Editar liquidaciones** desde su propio formulario | app |
| 04 | **Idempotencia del commit del importador** | core + web + app |
| 05 | **Panel: estado de notificaciones en la ficha del usuario** | web |

Orden propuesto: **01 → 03 → 04 → 05 → 02**. La 01 primero porque es la única donde hoy se puede
duplicar dinero; la 02 al final porque es la más grande y la única con puerta visual. El propietario
puede cambiar el orden.

### 01 · Import atómico y candado

- `knownHashes` se lee **dentro** de la transacción y **después** del `pg_advisory_xact_lock`, que es
  lo que su propio comentario ya promete. Sin eso, dos commits solapados duplican movimientos.
- `commitImport` acepta `newMembers` (`[{ name, userId? }]`) y los crea dentro de la misma
  transacción con el bloqueo por grupo; reutiliza la lógica de `addMember`, no la copia.
- El panel deja de llamar a `addMember` antes del commit; la app deja de llamar a `POST /members`
  en el mapeo y manda la elección en el commit.
- Mensaje de tamaño corregido: el límite es 2 MB, no 400 KB (`importer.ts:55`).

### 02 · Preferencias de notificación

- El maestro es del dispositivo: `devices.push_enabled` (por defecto `true`), y el emisor solo
  envía a `push_enabled and revoked_at is null`. Apagar **no** cierra la sesión ni borra el
  dispositivo, así que las casillas sobreviven a apagarlo y encenderlo.
- Las casillas se guardan como **silenciados por tipo** (`device_notification_mutes`), no como
  «encendidos»: el defecto es todo encendido y no hace falta sembrar nada.
- El catálogo de avisos lo sirve el servidor (tipo, módulo o generales), y el emisor descarta el
  evento antes de gastar cuota de FCM si su tipo está silenciado. Filtrar solo en el móvil queda
  descartado por decisión del propietario.
- La app estrena pantalla **Ajustes → Notificaciones** con el maestro, las generales y un
  desplegable por módulo con su logo (`/api/v1/modules/{key}/icon`, ya usado en Módulos) y el
  contador «1 de 2». Los logos y nombres salen de la instancia.
- Si el registro de push falla, la pantalla conserva la fila de reintento que hoy vive en Ajustes.
- 9 idiomas, `pnpm i18n:check` y OpenAPI actualizados.

### 03 · Editar liquidaciones

- `ManualPaymentDialog` gana modo edición (pagador, receptor, importe y fecha precargados).
- Tocar una liquidación abre ese diálogo, no el de gasto; el servidor ya acepta el `PATCH` con
  `kind: settlement` y un único receptor (`movements.ts:38-46`).
- Si una liquidación no se puede editar (no es tuya ni eres el creador), la fila no se abre.

### 04 · Idempotencia del import

- El commit acepta `Idempotency-Key`, como ya hace el alta de movimientos: misma clave y mismo
  cuerpo devuelven el resultado anterior; misma clave con otro cuerpo, `conflict`.
- Reutiliza `owe_no_idempotency` y el patrón de `service.ts:572-590`; no hay tabla nueva.
- La spec `2026-11-13-owe-no.md` ya lo promete: se cumple, no se retira.

### 05 · Panel: estado de notificaciones

- Una línea en la ficha del miembro o usuario: activas, desactivadas o sin dispositivo, leída de
  `devices.push_enabled` y `revoked_at`.

## Fuera de alcance

- Preferencias por cuenta (todos tus móviles a la vez) y por grupo de OweNo.
- Push de módulos que hoy no envían nada; el catálogo está preparado, pero no se inventan avisos.
- Centro de notificaciones, historial de avisos o correo.
- Capturas reales en la web: siguen siendo simuladas.
- Cambios de diseño del panel más allá de la línea de la ficha.

## Criterios de aceptación

- Importar dos veces a la vez no duplica ni un movimiento; cancelar el mapeo no deja miembros; un
  commit que falla no deja nada a medias.
- El mismo CSV con una fila extra importa solo la nueva (ya funciona) y un reintento exacto
  devuelve el mismo resultado sin otra línea en el historial.
- Apagar el maestro detiene el envío en el servidor y no cierra la sesión; volver a encenderlo
  conserva las casillas marcadas. Con dos Android reales: el que silencia invitaciones deja de
  recibirlas y el otro sigue.
- La pantalla muestra maestro, generales y módulos con logo; un módulo a medias dice «1 de 2».
- Una liquidación se corrige desde su propio formulario.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build`, `pnpm --filter db-tests test`,
  `pnpm i18n:check`, `pnpm check:openapi` y `./gradlew :app:testDebugUnitTest` en verde; auditoría
  de seguridad por otro agente antes de `finalizada`.

## Puertas de usuario

- **Firma de este README** para arrancar: **firmado por el propietario el 2026-11-23**.
- **P3**: mockup de una sola pantalla (claro y oscuro) de Ajustes → Notificaciones antes de escribir
  su UI.
- **Push real**: dos Android con FCM para la verificación de la tarea 02 (la antigua entrada 6 del backlog,
  que se cierra aquí).
- Orden explícita de merge a `staging` y, después, de `staging` a `main`.

## Evidencia (tarea 01, 2026-11-23)

PR: [#152](https://github.com/rferic/027apps/pull/152) (draft contra `staging`), siete checks en
verde: `admin`, `android`, `supabase`, `guard-secrets`, `ai-docs`, `commitlint` y Vercel.

| Comprobación | Resultado |
|---|---|
| `owe-no-imports.test.ts` | 12/12; el test nuevo fallaba antes del arreglo con `expected 2, received 4` |
| `@027apps/core` | 46 ficheros / 634 tests |
| `admin` | 172 ficheros / 1363 tests |
| `@027apps/owe-no` | 2 ficheros / 26 tests |
| `:app:testDebugUnitTest` | BUILD SUCCESSFUL |
| `pnpm lint` | 0 errores (21 avisos previos) |
| `pnpm tsc` | 7 áreas |
| `pnpm check:openapi` | 122/122 |
| `pnpm i18n:check` | 1116 cadenas / 9 locales |
| `pnpm --filter admin build` | OK |

`db-tests` completo no se ejecuta contra la instancia del propietario (asume una base limpia, ver
`docs/flows/pre-delivery-verification.md`); la suite de importaciones, que es la afectada, se cubre
entera.

## Relación con el sprint 18

El 18 está cerrado y en producción (v0.20.0). Comparte con este sprint el panel y la pantalla de
Ajustes de la app; el 18 ya no se toca. La migración de este sprint es la `0040`, después de
`0039_invitation_invariants.sql`.
