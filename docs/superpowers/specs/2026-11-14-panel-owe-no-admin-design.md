# Diseño: OweNo administrado desde el panel

- Fecha: 2026-11-14
- Estado: propuesta para aprobación del propietario
- Extiende la tarea 06 del sprint 15 y **sustituye D9** (el panel deja de ser solo lectura)
- Paquete: `packages/owe-no` · Panel: `apps/admin`

## 1. Intención y por qué

Hasta ahora el panel de OweNo era un escaparate: lista de grupos e importaciones, sin
ficha de grupo ni acciones. El propietario usa el panel como administrador de la
instancia, no como miembro, y espera poder entrar en un grupo, revisar movimientos,
crearlos, editarlos, borrarlos y liquidar sin pasar por la app. También quiere un
widget útil en el dashboard del panel.

La app sigue siendo la puerta del miembro (solo lo suyo, API-first). El panel es la
puerta del administrador (todo, con auditoría). Ambas usan **el mismo dominio**: las
reglas del dinero no se duplican.

## 2. Objetivos

1. Ficha de grupo en el panel: miembros, balances, movimientos y liquidación.
2. Movimientos: crear, editar (recalculando repartos) y borrar con baja lógica.
3. Liquidaciones: plan exacto o simplificado y registro del pago desde el panel.
4. Grupos: crear (el administrador queda como creador y miembro activo) y archivar/desarchivar.
5. Miembros: añadir una cuenta existente o un nombre ficticio, enlazar ficticio↔cuenta y quitar.
6. Widget del dashboard del panel con datos de instancia y estado vacío visible.
7. Todo en los 9 idiomas, con auditoría y tests de regresión.

## 3. No objetivos

- **Invitaciones por correo desde el panel**: dependen de envío, aceptación y de la app;
  se quedan donde están. El panel añade miembros ya existentes o ficticios.
- **Bloqueos**: la tabla `owe_no_blocks` existe pero ninguna regla la usa todavía; añadirla
  solo en el panel dejaría el comportamiento a medias. Cuando la app defina qué impide un
  bloqueo, se extiende.
- **Borrado físico** de grupos o movimientos: se pierde la trazabilidad.
- **Multidivisa** por grupo: decisión ya cerrada (una moneda por grupo).
- **Rutas dinámicas en el manifest** (ver §5): se harán como tarea propia si aparecen más fichas.
- **Permisos por usuario en el panel**: todos los `admin` pueden administrar OweNo.

## 3bis. Plataforma: el módulo como espacio de primera clase

Decisión del propietario (2026-11-14): lo que hoy cuelga de `/panel/modules/<key>` se reparte.

| Ruta | Qué es |
|---|---|
| `/panel/modules` | Catálogo: instalar, activar, desinstalar (en la barra se llama **Catálogo**, para no chocar con el grupo «Módulos»). |
| `/panel/modules/<key>` | **Solo la ficha del módulo**: estado, ajustes, concesiones, demo y trabajos (lo que hoy vive en `/settings`). |
| `/panel/<key>` | **Casa del módulo** (su primera página de administración). |
| `/panel/<key>/<route>` | Cada `admin_pages[].route` del manifest. |

- En la barra lateral, un grupo **«Módulos»** (debajo de «Inicio») con un item por módulo
  **instalado y activo**, con su logo y su nombre; la página actual se marca igual que el resto.
  No aparece si el rol del usuario no puede abrir ninguna de sus páginas.
- El módulo inactivo o no instalado desaparece del menú, pero sigue en `/panel/modules` para
  configurarlo.
- **Slugs reservados**: la `key` del módulo se valida contra las rutas fijas del panel
  (`modules`, `members`, `categories`, `invitations`, `keys`, `settings`, `docs`, `api`, `mcp`,
  `admin`, `core`). Un módulo con una clave reservada no instala y el error lo dice. Se añade a
  `RESERVED_MODULE_KEYS`/validación y a la documentación del contrato.
- **Compatibilidad**: `/panel/modules/<key>/<route>` redirige 308 a `/panel/<key>/<route>`;
  `/panel/modules/<key>/settings` redirige a `/panel/modules/<key>`.
- Las migas pasan a `Plataforma / <módulo> / <página>` y `<módulo>` enlaza a `/panel/<key>`.

Esto cambia el host de páginas de módulo y la navegación, no el manifest: `admin_pages` sigue
declarando rutas de un segmento. Es una tarea de plataforma que va **antes** de la administración
de OweNo.

## 4. Restricciones reales

- Las páginas de módulo se sirven en `/panel/<key>/<route>`: la página es estática (el manifest
  decide), pero el primer segmento es el módulo y exige una ruta dinámica en Next que resuelva
  contra el registro de páginas. No hay segmentos con id (`?group=` cubre el detalle).
- El panel usa la conexión de plataforma (`service_role`): las RLS no frenan al panel.
  **La autorización es código**: cada acción comprueba sesión y rol otra vez.
- El dominio del módulo ya expone `addMovement` y `deleteMovement` para miembros, con
  reglas (autor o creador del grupo para borrar). Las funciones de administración deben
  ser explícitas y no relajar las de miembro.
- Los textos de las páginas de módulo salen de `locales/<locale>.json` (§ páginas de
  admin en `docs/ai/module-system.md`).
- iOS no existe; la app Android no cambia en esta tanda salvo lo que comparta dominio.

## 5. Enfoques

### 5.1 Ficha de grupo: parámetro frente a ruta dinámica

| Enfoque | Qué implica | Valoración |
|---|---|---|
| **A. `?group=<id>`** (elegido) | Se añade `searchParams` a `ModulePageContext`; `groups` pinta lista o detalle según el parámetro. Sin tocar el manifest ni el contrato de módulos. | Barato, suficiente para una ficha, se puede enlazar y recargar. URL algo larga. |
| B. Rutas dinámicas (`groups/[id]`) | Cambia el esquema del manifest, la validación, el registro estático de páginas, la documentación y los envoltorios. | Es la solución general, pero merece su propia spec y su bump de contrato. |
| C. Ruta del panel fuera del host (`/panel/owe-no/...`) | Rompe D20 y la encapsulación del módulo. | Descartado. |

Se elige A. Cuando haya una segunda ficha de detalle se abre la tarea de rutas dinámicas.

### 5.2 Dónde vive la administración

| Enfoque | Qué implica | Valoración |
|---|---|---|
| **A. `packages/owe-no/src/admin.ts`** (elegido) | Dominio de administración con `Caller` y rol comprobado; reutiliza validadores y cálculo de repartos del módulo. | Una sola regla, testeable sin panel, reutilizable por la app cuando toque. |
| B. SQL directo en las páginas del panel | Menos capas. | Duplica reglas, salta validaciones y auditoría. Descartado. |
| C. Endpoints públicos `/api/v1/owe-no/admin/...` | Permite terceros y app. | Superficie nueva que hoy nadie consume; OpenAPI y auditoría extra. Se pospone hasta que exista un consumidor. |

### 5.3 Cómo escribe el panel (y dónde vive la página)

El paquete no puede importar el panel (`@/` es alias de la app) ni depender de Next. Tras la
revisión del diseño se separa **UI de cableado**:

- `packages/owe-no/admin/<route>/page.tsx` exporta el componente **presentacional**: recibe
  `ModulePageContext` y los datos ya resueltos (o los lee con `context.db`) y **no conoce
  Server Actions**.
- Cuando una página necesita escribir, el registro `MODULE_PAGES` del panel apunta a un
  **envoltorio de la app** (`apps/admin/src/components/owe-no/<route>-page.tsx`) que importa el
  componente del paquete, le pasa las acciones y conserva el mismo `context` (idioma y
  mensajes incluidos). El envoltorio también es quien llama a `notFound()` para un
  `?group=` inválido o inexistente: el paquete no depende de `next/navigation`.
- Las acciones siguen en `apps/admin/src/lib/owe-no-actions.ts` (`"use server"`), con
  `requirePanel("admin")` repetido, zod, `revalidatePath` y errores tipados.

Esto mantiene el contrato del módulo (manifest, ruta estática y `page.tsx` en el paquete), el
paquete sin dependencia de Next y las acciones donde vive la sesión. El envoltorio es fino por
diseño: no decide permisos ni reglas, solo conecta. Se documenta en `module-system.md`.

| Enfoque | Qué implica | Valoración |
|---|---|---|
| **A. Componente presentacional + envoltorio con acciones** (elegido) | Ver arriba. | Sin dependencias nuevas, sin endpoints, reglas en el dominio. |
| B. Server Actions dentro del paquete | El paquete importa `next/cache` y necesita la sesión del panel, que es código de la app. | Acopla el paquete a Next y duplica el gate. Descartado. |
| C. Endpoints públicos de administración | Requiere abrir `/api/v1/owe-no/admin/...`, OpenAPI y consumidor real. | Se pospone (§5.2 C). |

## 6. Modelo de datos y auditoría

Migración `1.3.0` (con su `down`):

- `owe_no_groups.archived_by uuid references public.profiles(id) on delete set null`
- `owe_no_members.added_by uuid references public.profiles(id) on delete set null`
- Vista `owe_no_balances` (`group_id`, `member_id`, `amount_minor`) con la definición de
  `balances()`: suma de lo pagado menos la suma de sus participaciones, ignorando movimientos
  con `deleted_at`. `security_invoker` y sin `grant` a `authenticated`: solo la leen el dominio
  (vía el panel, `service_role`) y la función del widget. Su `down` la borra junto a las columnas.

Ya existen y se usan tal cual: `owe_no_movements.created_by`, `updated_by`, `deleted_at`,
`deleted_by`; `owe_no_members.state`; `owe_no_blocks` (sin reglas, ver §3).

Reglas de escritura:

- **Crear grupo**: el administrador es `created_by` y queda como miembro activo con su
  `display_name`. Sin él, el grupo nacería sin pagador posible.
- **Archivar**: `archived_at`/`archived_by`. Un grupo archivado es **solo lectura en el
  dominio**, no solo en el panel: `addMovement`, `deleteMovement`, `addMember`, `linkMember` y
  las funciones de administración comprueban `archived_at is null` y devuelven `conflict`. Se
  aplica también a la app (hoy solo `addMovement` lo comprobaba). No se tocan las políticas RLS:
  el cambio es de dominio y se prueba ahí. Desarchivar lo reabre.
- **Añadir miembro**: `state='active'`, `added_by`. Con `user_id` si es una cuenta
  existente; sin él si es ficticio. Un usuario ya presente (activo, invitado o expulsado)
  es `409`.
- **Quitar miembro**: `state='removed'`, `left_at=now()`. **Solo con saldo cero**: un miembro
  con balance no se puede quitar (ni desde el panel ni desde la app) porque después ningún pago
  podría saldarlo — `validateMovement` exige pagador y participantes activos. El panel muestra
  el motivo y enlaza a liquidar.
- **Enlazar ficticio↔cuenta**: asigna `user_id` si la cuenta no está ya en el grupo.
- **Crear movimiento**: valida igual que el dominio de miembro (importe > 0, pagador
  activo, participantes activos, reparto exacto o a partes iguales con resto).
- **Editar movimiento**: descripción, importe, pagador, participantes, fecha y categoría.
  **El tipo (`expense`/`settlement`) es inmutable**: cambiarlo es borrar y crear. Se
  recalculan los repartos y se graba `updated_by`.
- **Borrar movimiento**: baja lógica (`deleted_at`, `deleted_by`), sin importar el autor
  original. Los balances se recalculan solos.
- **Liquidar**: el plan se calcula con `settle()` y cada transferencia se registra como un
  movimiento `kind='settlement'` (pagador = deudor, participante = receptor). También se
  permite un pago manual con importe libre, validado contra el saldo del deudor.
- **Eventos**: toda escritura (miembro o administración) emite `owe_no.movement_created`,
  `owe_no.movement_updated` (hoy declarado y sin emisor) o `owe_no.movement_deleted` por el
  outbox. El push sigue el contrato del manifest y **hoy está inactivo** porque FCM está
  bloqueado; cuando se active, una edición del panel también notificará, como cualquier otra.

## 7. Interfaz

### 7.1 Resumen (`/panel/owe-no`)

Casa del módulo, con su navegación propia (Resumen · Grupos · Importaciones · Ajustes). El
resumen es lo que hoy hace la página del módulo, con acceso directo a «Grupos» y un botón
**Nuevo grupo**. «Ajustes» enlaza a `/panel/modules/owe-no`.

### 7.2 Grupos (`/panel/owe-no/groups`)

- Sin `?group=`: lista con nombre, moneda, miembros activos, movimientos y estado
  (archivado), más buscador por nombre y botón **Nuevo grupo**.
- Con `?group=<uuid>`: ficha.
  - Cabecera: nombre, moneda, estado, **Archivar/Desarchivar**.
  - **Balances** por miembro (verde/rojo) y aviso si el plan es simplificado.
  - **Miembros**: nombre, estado, cuenta enlazada o «ficticio»; acciones añadir, enlazar y
    quitar.
  - **Movimientos**: fecha, descripción, pagador, importe, tipo y reparto resumido; acciones
    editar y borrar (con confirmación). Se listan los últimos 200, avisando si hay más.
  - Botones **Añadir gasto** y **Liquidar**.
- Diálogos: nuevo grupo, añadir miembro, enlazar cuenta, movimiento (alta/edición) con
  reparto igual o exacto y vista previa de la parte de cada uno, y liquidación con el plan
  y un botón por transferencia.
- Móvil: tarjetas y diálogos a ancho completo, como el resto del panel.

### 7.3 Widget del dashboard

Dos widgets de panel, ambos de instancia (ignoran `uid`):

| Widget | `value` | `detail` |
|---|---|---|
| `owe-no.groups` | Grupos activos | `{members}` miembros · `{movements}` movimientos |
| `owe-no.pending` | Grupos activos con saldo ≠ 0 | `{currencies}` monedas con saldo (solo si hay más de una) |

- Con cero grupos devuelven **0**, no `null`: la tarjeta se ve en vez de desaparecer.
- Sin totales de dinero: **no se suman monedas distintas** y el panel no formatea céntimos.
- **Enlaces**: cada tarjeta lleva al módulo (`/panel/<key>`), que es donde se administra. El
  panel deriva el enlace de `module_key`; el módulo no inyecta URLs.
- **Marca**: la tarjeta muestra el logo del módulo y su nombre, como el menú lateral.
- **Traducción**: el panel aplica `t()` con los `locales/*.json` del módulo a `title`, `label` y
  `detail`, y los datos pueden traer `params` para interpolar cifras. Es la extensión compatible
  del contrato de widgets (forma de datos opcional) y se documenta en `module-system.md`.
- **Regla de dinero**: `pending` usa la vista `owe_no_balances` (migración `1.3.0`), la misma
  definición `pagado − debe` que el dominio, con un test que comprueba que vista y `balances()`
  coinciden para un grupo de fixture.

## 8. Contrato de módulos (cambios)

- `ModulePageContext` gana `searchParams: Record<string, string | string[] | undefined>`.
  Es aditivo: las páginas que no lo usan no cambian; el manifest no cambia; no hay bump de
  `contract`.
- El registro `MODULE_PAGES` puede apuntar a un **envoltorio de la app** que inyecta acciones en
  un componente presentacional del paquete (§5.3). El manifest y el `page.tsx` del paquete siguen
  siendo el contrato; el envoltorio no decide reglas.
- Documentar en `docs/ai/module-system.md`: `?param` como mecanismo para detalle mientras
  no haya rutas dinámicas, que las páginas deben validar el parámetro, el patrón
  presentacional + envoltorio, y la traducción de los textos del widget (`t()` + `params`).

## 9. i18n

Todas las cadenas nuevas entran en `locales/*.json` de OweNo (9 idiomas) y se traducen con
`t(texto, context.messages)`: etiquetas de acciones, diálogos, estados y avisos. Los textos del
widget (`title`, `label`, `detail`) se traducen en el panel con el mismo mapa y sus `params`.

## 10. Tests

- **Dominio** (`packages/db-tests` o tests de paquete, según lo que ya exista):
  rol no admin rechazado; crear grupo deja creador miembro activo; añadir/enlazar/quitar
  miembro; grupo archivado rechaza escrituras; crear/editar/borrar movimiento con
  auditoría y repartos recalculados; liquidación exacta y simplificada; pago manual
  validado contra saldo; miembro expulsado con saldo no rompe balances.
- **Acciones del panel**: gate repetido, zod, error tipado y `revalidatePath`; nunca
  aceptan ids de otro grupo.
- **Páginas**: render en español sin literales ingleses; lista vacía; ficha con datos;
  `?group` inválido o inexistente → 404 desde el envoltorio; quitar un miembro con saldo →
  error visible con enlace a liquidar.
- **Widget**: con cero grupos devuelve ceros; con datos, grupos y detalle traducido; la tarjeta
  enlaza a `/panel/owe-no`; la vista `owe_no_balances` coincide con `balances()`.
- **Plataforma**: `/panel/owe-no` y sus páginas resuelven; el item del menú aparece solo con el
  módulo activo y rol suficiente; un módulo inactivo no aparece; las URLs viejas redirigen; una
  `key` reservada no instala.
- **Eventos**: crear, editar y borrar emiten su evento una vez, también desde el panel.
- **Manual**: `scripts/verify-local.sh` cubre la ficha con un grupo creado desde el panel;
  navegador con `diag browser_toggle` y `request lenses` sin incidencias.

## 11. Seguridad

- Toda acción revalida sesión y rol (`requirePanel("admin")`) **y** el dominio comprueba
  el rol otra vez con el `Caller`.
- Ids por zod (`uuid`); el grupo de la ruta se usa siempre como filtro (`where group_id = $2`),
  nunca se confía en el id del cuerpo.
- Sin SQL interpolado; consultas parametrizadas.
- Errores de dominio mapeados a mensajes de UI sin detalle interno.
- Auditoría obligatoria (`created_by`, `updated_by`, `deleted_by`, `added_by`, `archived_by`).
- Server Actions: origen y CSRF los cubre Next; no hay endpoints nuevos que exponer.

## 12. Lo que queda a criterio del constructor

- Componentes exactos del DS para la tabla y los diálogos (seguir el panel).
- Paginación fina de movimientos si 200 resulta corto.
- Textos definitivos de las traducciones.
- Si el buscador de grupos filtra en servidor o en cliente (con pocos grupos, cliente).

## 13. Entregables

1. **Plataforma**: host de módulos bajo `/panel/<key>`, grupo «Módulos» en la barra lateral con
   logo y nombre, ficha en `/panel/modules/<key>`, redirecciones y slugs reservados + tests.
2. Migración `1.3.0` (columnas, vista `owe_no_balances`) + dominio `admin.ts` + tests.
3. Acciones del panel + páginas presentacionales y envoltorios (lista y ficha) + i18n + tests.
4. Widgets del panel (dos, con logo, enlace y traducción) + tests.
5. Docs: `module-system.md` (rutas, envoltorio, widgets, slugs), README del paquete, sprint
   README (D26 sustituye D9, D27 fija las rutas) y checklist de verificación.
6. Mockups aceptados antes de tocar UI.
