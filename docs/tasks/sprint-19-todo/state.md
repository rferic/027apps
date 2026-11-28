# Estado de creación del módulo `todo`

> Plantilla de `new-module`. Es la memoria del proceso: si una sesión se interrumpe, el
> siguiente agente continúa desde aquí. No sustituye a la spec ni al plan.

**Módulo:** `todo` — NotNow
**Fecha de inicio:** 2026-11-27
**Última actualización:** 2026-11-28
**Estado:** `implementacion` (tareas 01–12 en `test`)
**Siguiente paso:** aceptación del propietario en staging con el APK de debug (incluido el push con
botones, que necesita FCM real); después, orden explícita de merge del PR del sprint y promoción
`staging → main` como PR aparte. La landing pasa NotNow a `available` en el mismo PR de aceptación.

## 1. Brief

- **Idea:** post-its de tareas dentro de grupos que crea el propio usuario, más un grupo
  personal por usuario.
- **Necesidad:** repartir lo cotidiano sin convertirlo en un tablero de gestión de proyectos.
- **Concepto:** una tarea es un post-it: está **pendiente o hecha**, se crea **libre** (la coge
  quien quiera) o **puesta a alguien**, y puede ser **puntual** (con fecha máxima opcional) o
  **periódica** (semanal, mensual, anual). El grupo puede activar **power**: cada tarea vale
  1–5 y quien la completa suma; hay temporadas con página de resultados.
- **No es:** un kanban, ni un gestor de proyectos, ni tiene columnas ni arrastrar tarjetas.

## 2. Ejemplos y referencias

- `~/Sites/027apps-legacy/apps/todo` (v1.0.0, «To-Do») — referencia funcional anterior.
  Reutilizable: categorías globales con emoji y color, vencimiento con resalte, asignación,
  recurrencia, «Coger» desde el widget, preferencias de aviso.
  **No** reutilizable: los estados `in_progress`/`cancelled`, el email como canal, el hex libre
  por categoría, `group_members` del Core antiguo (aquí los grupos son del módulo) y la
  prioridad como escala (la sustituye el power).

## 3. Identidad y manifest

- **Nombre:** **NotNow** (elegido el 2026-11-27; «tareas» sigue siendo el concepto, no la marca)
- **Key:** `todo` (no reservada)
- **Icono/logo:** **G · la nota maciza con el check recortado** (2026-11-28), tras tres rondas de
  propuestas. `assets/icon.svg` es la versión a una tinta (`fill="currentColor"`,
  `fill-rule="evenodd"`, hoja con esquina cortada y check en negativo); `assets/logo.svg` es la de
  dos tonos para la landing y la ficha del panel. **OweNo** pasa a **B · dos personas, un gasto**
  (dos círculos solapados con el lente sólido) en `packages/owe-no/assets/{icon,logo}.svg`.
- **Branding:** `color: indigo` (`--module-indigo`, `#4f46e5` / `#818cf8`); descripción en
  inglés en el manifest: «Shared tasks as post-its: take one, get one, earn power»
- **Manifest:** `packages/todo/manifest.json` en **1.4.0** (contrato 1, cinco migraciones con
  digests, 12 eventos, 1 canal, 1 job, 2 widgets, 2 páginas de panel, hooks de demo)
- **Validación contra el esquema:** verde en `packages/todo/src/manifest.test.ts`

## 4. Análisis y enriquecimiento

- **Propuesta enriquecida:** el concepto del propietario, con estas decisiones cerradas.
- **Encaje con el Core:** paquete propio con esquema `module_todo`; el Core aporta push y
  canales, widgets de dashboard, scopes, MCP, páginas de admin, i18n y el mute por tipo de
  aviso en cada móvil (las tareas aparecerán solas en Ajustes → Notificaciones).
- **Riesgos detectados:**
  - Los puntos y el historial deben cuadrar: borrar o reabrir una tarea hecha mueve el
    marcador, así que hace falta un libro de puntos, no un contador.
  - La solicitud con botones en la notificación es la pieza más delicada (sin red, doble toque,
    dos solicitudes a la vez).
  - Las periódicas necesitan una ocurrencia por periodo; sin ella el historial y el aviso de
    cierre se pisan.
- **Contradicciones resueltas:**
  - Prioridades fuera: el power es la única escala.
  - No hay privilegios de creador: manda quien tiene la tarea.
  - «Infinito» = sin fecha de cierre; el grupo cierra temporada cuando quiere.

## 5. Requisitos cerrados

### Reglas del dominio

- **Emoji en los títulos:** el nombre del grupo y el título de la tarea admiten emoji **dentro del
  texto** (`🏠 Casa`, `💡💡 Cambiar la bombilla`), con un selector de emojis frecuentes en el
  formulario y el teclado libre. Sin campo aparte; los límites se cuentan por puntos de código,
  porque un emoji es un carácter en PostgreSQL y dos en JavaScript.
- **Alta rápida:** el «+» de Inicio abre el formulario de tarea preguntando a qué grupo va (con
  la grupo personal entre las opciones y la última usada preseleccionada). Desde dentro de un
  grupo, el grupo se deduce y el formulario no pregunta. Se declara como `app_actions: new_task`.
- **Independencia de OweNo:** los grupos de NotNow son suyos, no los de OweNo. Tablas, miembros y
  permisos separados, sin `requires` ni ids compartidos; desinstalar un módulo no toca al otro.
- **Grupo:** lo crea un usuario y él gestiona sus miembros (añadir y echar). El admin de la
  instancia puede verlo y tocarlo todo desde el panel.
- **Grupo personal:** cada usuario tiene un grupo con un solo miembro (él) y **sin power**. No
  compite con nada.
- **Estado de una tarea:** `pendiente` o `hecha`. Nada más.
- **Una sola persona** puede tener una tarea en su poder.
- **Regla de oro de permisos:** si la tarea está **libre**, cualquier miembro del grupo la edita
  y puede cogerla; si está **asignada**, solo su dueño la edita y la completa. No hay
  privilegios de creador.
- **Coger una tarea libre:** asignándotela. Para completarla hay que tenerla.
- **Devolverla:** el dueño puede dejarla libre, avisando al grupo.
- **Pedir una tarea ajena:** el interesado envía una solicitud; el dueño actual acepta o
  deniega. El push lleva botones **Aceptar/Denegar** y además la solicitud aparece en una
  bandeja dentro de la app, para quien perdió la notificación. Al resolver, desaparece de ambos
  sitios y se avisa al solicitante si se aceptó. Una sola solicitud pendiente por tarea, y
  caduca a los 7 días.
- **Puntual:** fecha máxima opcional (día completo). **Periódica:** semanal, mensual o anual; el
  fin de periodo hace de fecha. Al crearla se decide si al cerrar el periodo **sigue con la
  misma persona** o **vuelve a estar libre**.
- **Recurrencia:** la misma tarea se reinicia cada periodo, con historial de cada vez que se
  completó (fecha y quién).
- **Completar:** solo el dueño. Se puede **deshacer** mientras la temporada siga abierta y se
  restan los puntos.
- **Borrar:** una tarea **pendiente** se puede borrar (el dueño, o cualquiera si está libre);
  una **hecha** no se borra, cuenta para el power.
- **Power (por grupo, aislado entre grupos):** el grupo lo activa; cada tarea vale 1–5 (lo pone
  quien la crea y se puede editar); quien la completa suma. Modos: **infinito** (sin fecha de
  cierre) o **temporada** semanal, mensual o anual. Al cerrar temporada se genera la **página de
  resultados** (posición, puntos y tareas hechas por persona), se archiva y se resetea. En
  infinito, el grupo cierra temporada a mano cuando quiera. La grupo personal no juega.
- **Avisos (nunca al actor):** creación → grupo si está libre, asignado si tiene dueño;
  asignación → el nuevo dueño; devolución → el grupo; vencimiento o cierre de periodo sin hacer
  → grupo si libre, dueño si asignada; completar → **siempre el grupo**; solicitud → el dueño
  actual; resolución → el solicitante.

### Límites de v1 y defaults propuestos (corrígelos si algo no encaja)

- Fecha máxima = día completo, hasta las 23:59 de la zona del grupo. **Un solo aviso** de
  vencimiento, no insiste.
- Los periodos se calculan en la **zona del grupo** (la del creador al crearlo).
- Las tareas hechas **no desaparecen**: viven en un filtro «hechas».
- **Panel:** lista todos los grupos y tareas en lectura y permite borrar una tarea **pendiente**
  con auditoría; nunca toca puntos.
- **Settings de instancia:** `default_power` (1–5, por defecto 1) y `request_ttl_days` (7).
- **Widgets:** `todo.my_tasks` en la app («Mis tareas»: pendientes y próxima fecha) y
  `todo.power` en el panel (clasificación de la temporada en curso).
- **`is_public`: `true`** — es de la familia; cualquiera tiene su grupo personal y puede crear
  grupos.
- **Sin límite** de grupos por usuario ni de miembros por grupo.

### No-objetivos de v1

Kanban y columnas; subtareas y checklists dentro de la tarea; adjuntos, fotos o comentarios;
etiquetas libres; calendario; asignación múltiple; dependencias entre tareas; plantillas;
recordatorios repetidos o «posponer»; editar la fecha de una tarea ya vencida sin reabrirla.

### Superficie prevista

- **Tablas:** `todo_groups`, `todo_group_members`, `todo_tasks`, `todo_task_occurrences`
  (historial por periodo), `todo_requests`, `todo_seasons`, `todo_power_events` (libro de
  puntos, para que borrar/reabrir cuadre).
- **API:** grupos y miembros, tareas (crear, editar, coger, soltar, completar, deshacer, borrar),
  solicitudes (crear, aceptar, denegar, caducar), power (tabla de la temporada, cerrar).
- **Scopes:** `tasks:read`, `tasks:write`, `groups:read`, `groups:write`, `power:read`.
- **MCP:** lectura (grupos, tareas, power) y escritura (crear y completar tarea) oculta por
  defecto con `mcp_exposed = read`.
- **Eventos:** `task.created`, `task.assigned`, `task.released`, `task.completed`,
  `task.overdue`, `request.created`, `request.resolved`, `season.closed`.
- **Canales:** `todo-group-{id}` con `members_fn` security definer.
- **Locales:** `en`, `es`, `ca`, `it`, `fr`, `de`, `pt`, `gl`, `eu`.
- **Moneda/fechas:** sin moneda; fechas con zona (ADR 0008).

## 6. Dependencias del Core

| Dependencia | Estado real | Efecto si falta |
|---|---|---|
| Esquema zod + registry | implementada | validación mecánica bloqueante |
| Suite RLS | implementada (`db-tests`) | tests de aislamiento bloqueantes |
| Componentes del DS | implementada | UI bloqueada |
| Pipeline i18n | implementada | verificación bloqueante |
| Instalador en runtime | implementada (OweNo instala y desinstala) | install/activate/uninstall bloqueados |
| API `/api/v1` del Core | implementada | endpoints dependientes bloqueados |
| Shell del admin | implementada | `admin_pages` bloqueadas |
| Push con acciones (botones) en la notificación | implementado (pendiente de probar con FCM real) | el receptor y el payload `request_id` ya existen; sin FCM en local no hay notificación que pulsar |

## 7. Artefactos

- **Spec:** `docs/superpowers/specs/2026-11-27-todo.md` — aprobada, actualizada con lo aprendido
  (migraciones, eventos de periodo, contrato publicado)
- **Mockup:** `docs/mockups/todo/index.html` — aceptado
- **Plan:** `docs/superpowers/plans/2026-11-27-todo.md` — aprobado 2026-11-27
- **Paquete:** `packages/todo/` — implementado en 1.4.0; API publicada en OpenAPI (26 operaciones)

## 8. Puertas

- [ ] Requisitos cerrados por el usuario.
- [ ] ¿Empezamos el spec? — respuesta explícita.
- [ ] Spec + mockup aceptados por el usuario.
- [x] Plan aprobado por el usuario (2026-11-27).
- [ ] UI aceptada (si aplica). — recorrida en local con dos usuarios; falta la aceptación del
  propietario sobre el APK de staging, incluido el push con botones (requiere FCM, no hay
  credenciales en local: el propio Ajustes avisa «FCM public configuration is missing»).
- [ ] Aceptación del resultado y orden de merge.

## 9. Dudas abiertas

- Ninguna bloqueante. Los defaults de §5 se confirman o se corrigen en la puerta de requisitos.
- Los **botones en la notificación** dependen de una capacidad del Core que no existe todavía:
  se puede entregar la solicitud con push que abre la app y añadir las acciones después, o
  incluir esa capacidad en el sprint.

## 10. Bitácora

- `2026-11-27` — intake, referencia legacy, concepto del propietario y cuatro tandas de
  preguntas. Cerradas: grupos propios, grupo personal sin power, power por grupo y aislado,
  una sola persona por tarea, sin privilegios de creador, solicitudes con botones y bandeja,
  recurrencia con historial, deshacer con resta de puntos, borrado solo de pendientes,
  resultados por temporada con archivo, solicitud a 24 h y contador de puntos sin libro.
- `2026-11-27` — escritos el spec (`docs/superpowers/specs/2026-11-27-todo.md`) y el mockup
  (`docs/mockups/todo/index.html`). El manifest borrador valida contra `validateManifest`.
  Elegido el logo **A · lista con checks** de cuatro propuestas. Confirmados los cuatro tipos de
  aviso en el Core. Añadido el emoji en el título de grupos y tareas. Spec y mockup aprobados;
  escrito el plan (`docs/superpowers/plans/2026-11-27-todo.md`) y el sprint
  (`docs/tasks/sprint-19-todo/README.md`, tareas 01–12). Plan aprobado el 2026-11-27.
- `2026-11-27` — **tarea 01** en `test`: paquete `packages/todo`, manifest validado con digests,
  DDL 1.0.0 con diez tablas, vista y helpers, RLS de solo lectura, e instalación/desinstalación
  comprobadas en `db-tests` (352 tests en verde).
- `2026-11-27` — **tarea 02** en `test`: `permissions.ts` (reglas puras, 21 tests) y `groups.ts`
  (grupos, miembros, grupo personal idempotente, echar libera tareas y caduca solicitudes),
  con `todo-group_members`/`todo_groups` cualificados por esquema. `db-tests` en 356.
- `2026-11-28` — logos cerrados tras la revisión del propietario: OweNo **B** y NotNow **G**.
  Guardados los cuatro SVG (icono monocromo y logo a dos tonos de cada módulo). El icono de
  OweNo cambia en su paquete; no toca SQL ni versión del manifest.
- `2026-11-28` — **tareas 03–06** en `test`: ciclo de vida de la tarea (coger, soltar,
  completar, borrar), recurrencia con ocurrencias y cierre de periodo, solicitudes a 24 h con
  caducidad, y power con temporadas, archivo y el job horario `job_hourly` (idempotente y con
  puesta al día de varias temporadas). `db-tests` en 18 casos del módulo.
- `2026-11-28` — hallazgo del Core: `assertSafeModuleSql` prohíbe la palabra `do` en cualquier
  contexto, así que un módulo no puede usar `on conflict`. Se ha esquivado con `where not exists`
  en el job; conviene afinarlo en el Core (bloquear `DO $$`, no `on conflict`).
- `2026-11-28` — terminología unificada: el contenedor se llama **grupo** en UI, spec, plan y
  código. El privado de cada usuario es su **grupo personal** («Personal»), con un solo miembro.
  Desaparece la palabra «carpeta».
- `2026-11-28` — dejado explícito que NotNow y OweNo no comparten grupos: spec §1.3, criterio de
  aceptación 16 y una comprobación en el test del manifest de que el módulo no declara `requires`.
- `2026-11-28` — **tarea 07** en `test`: `apps/admin/src/lib/todo.ts` (door, mapeo de errores del
  dominio, `profileContext`, `personalName`, `parseQuery`) y las 19 rutas de `/api/v1/todo` con
  sus scopes, rate limits y esquemas zod. 36 tests en el paquete; `admin` 1364 en verde.
- `2026-11-28` — **tarea 08** (servidor) en `test`: catálogo de avisos del Core ampliado con los
  cuatro tipos de NotNow, y `events.ts` con los diez eventos cableados en tareas, solicitudes y
  cierre de temporada. Cada `resource` lleva `actor_id`, que es como el Core excluye al actor del
  push. Pendiente de la app: los textos y los botones Aceptar/Denegar de la notificación (tarea 10).
- `2026-11-28` — **tarea 09** en `test`: `/panel/todo` (resumen de grupos, solo lectura) y
  `/panel/todo/categories` (catálogo con formularios nativos y acciones de servidor), registrados en
  `MODULE_PAGES` y declarados en `admin_pages`. Los imports internos del paquete pasan a ir sin
  extensión, que es lo que resuelve Turbopack (OweNo ya lo hacía así).
- `2026-11-28` — **tarea 11** en `test`: migración `1.2.0` con los widgets `todo.my_tasks` y
  `todo.metric`, los hooks `seed_demo`/`clear_demo` (idempotentes y sin tocar datos de la familia),
  las 27 claves de panel traducidas a los nueve idiomas y la documentación por capacidad completa.
  `i18n:check` en verde.
- `2026-11-28` — **instalado y probado de punta a punta en local**: instancia montada
  (`eric@local.test`), módulo `todo` instalado y activo en `1.2.0`, demo sembrada y flujo completo
  por HTTP con dos usuarios (crear puntual y periódica, coger, completar, power con posiciones,
  solicitud, aceptar, y archivo de temporadas). Dos fallos encontrados y corregidos: la demo
  acreditaba los puntos a quien no había hecho la tarea, y las fechas de solicitud salían como
  `Date.toString()` en vez de ISO.
- `2026-11-28` — **tarea 10** en `en curso`: pantallas de NotNow en la app (`TodoScreen`), DTOs y
  métodos del cliente, enrutado por `openModule`, alta rápida desde el «+» (`new_task`), destinos
  del push (`todo_group`) y 36 cadenas nuevas en los nueve idiomas. Compila, `assembleDebug` y los
  tests unitarios pasan, y el APK está instalado en el emulador apuntando a `10.0.2.2:3003`.
  **No verificada todavía**: el login por adb se atasca (el teclado del emulador intercala
  caracteres) y el reinicio del entorno cortó la sesión. No pasa a `test` hasta recorrerla.
- `2026-11-28` — **por qué fallaba el login en el emulador**: `/api/v1/instance` publica
  `supabase_url: http://127.0.0.1:54321`, y el `127.0.0.1` del emulador es él mismo. Con
  `adb reverse tcp:54321 tcp:54321` el login funciona a la primera; no era el teclado. El APK de
  debug necesita ese `adb reverse` en cada arranque del emulador (documentado en `task-10.md`).
- `2026-11-28` — **tarea 10 en `test`**: recorrida completa en el emulador con dos usuarios.
  Pantallas: grupos + Personal, grupo (pendientes/hechas, coger, completar, soltar, pedir), alta
  con emoji y power, alta asignada, detalle con edición, historial de periodos, deshacer, borrar,
  bandeja (me las piden / he pedido, aceptar), power, cierre de temporada, archivo y resultados,
  alta de grupo con power y periodo, ajustes del grupo (miembros, añadir/echar, borrar) y ajustes
  en solo lectura para quien no es dueño. Nueve pantallas de móvil del mockup cubiertas salvo el
  push con botones (ver abajo).
- `2026-11-28` — **cambios de servidor que la app necesitó**: la bandeja nombra tarea, grupo y
  solicitante (`taskTitle`/`groupName`/`requesterName`) y excluye las solicitudes propias de
  «me las piden»; `GET /tasks/{id}` devuelve `{ task, occurrences }`; la tarea lleva
  `assigneeName`. El payload del push incluye `description` (el título), `group_name`, `actor_name`
  y `request_id`, que es lo que permiten los botones Aceptar/Denegar sin abrir la app.
- `2026-11-28` — **idempotencia implementada** (`withIdempotency`): `Idempotency-Key` obligatorio en
  crear tarea, completar y solicitar; transacción + cerrojo por clave, respuesta guardada y
  reutilización de clave en otro endpoint rechazada. La app manda una clave nueva por acción y
  reutiliza la misma en el reintento tras un 401.
- `2026-11-28` — **aviso de vencida y de periodo perdido implementados**: migración `1.3.0` con
  `overdue_notified_on` y `occurrences.notified_at`; el barrido corre al abrir el módulo o sus
  tareas (el SQL de un módulo no puede escribir el outbox del Core) y emite una sola vez. Se añaden
  los dos eventos `todo.task_missed_period[_assigned]` al manifest, al catálogo de avisos y a
  `docs/events.md` (12 eventos).
- `2026-11-28` — **demo rota en instalación limpia**: `seed_demo` usaba el id de categoría del Core
  como `todo_tasks.category_id`, que apunta al catálogo del módulo; en una instancia recién
  instalada ese id no existe y el FK tumbaba el sembrado. Migración `1.4.0`: la demo crea/reutiliza
  su categoría «Casa» en `todo_categories`. Verificado con `POST /api/v1/demo` sobre módulo limpio.
- `2026-11-28` — **OpenAPI**: el módulo no estaba publicado (`check:openapi` fallaba con 19 rutas
  sin operación). Añadidas 26 operaciones en `packages/core/src/openapi/todo.ts`; el documento
  declara ahora 150 de 150. El generador no tiene hueco para cabeceras: el `Idempotency-Key` se
  documenta en la descripción de las tres operaciones.
- `2026-11-28` — **auditorías en paralelo** (calidad, estilo y seguridad; ver §11). La de seguridad
  no encontró críticos ni altos; la de calidad sí encontró tres altos reales que se corrigieron:
  `reopenTask` devolvía una tarea parcial (la app fallaba al deshacer), el receptor de la
  notificación no llevaba el bypass de Vercel y hacía `Toast` fuera del hilo principal, y la app
  ofrecía «Borrar» en tareas ajenas. También se corrigieron: la bandeja no comprueba membresía
  (fuga de metadatos a un expulsado), las claves de idempotencia no caducaban, echar a alguien no
  caducaba las solicitudes sobre sus tareas ni avisaba al grupo, `updateTask` no replicaba las
  validaciones de `createTask`, y las etiquetas de los cuatro avisos y el widget de tareas no
  estaban traducidos en Ajustes/Inicio. Todo con tests donde había dominio.
- `2026-11-28` — **verificación final**: `pnpm lint` (0 errores, avisos previos de `<img>`),
  `pnpm tsc` limpio, `pnpm --filter admin build` compila, core 642, admin 1364, todo 36, Android 158
  tests unitarios (incluye etiquetas de los cuatro avisos), `i18n:check` verde (1147 cadenas) y
  `check:openapi` 150/150. `db-tests` **383 en verde** con la instancia limpia (módulo desinstalado
  y demo borrada); con el módulo instalado o la demo sembrada, siete pruebas de otros paquetes
  cuentan filas del registro/catálogo y fallan: es estado del entorno, no del código. La suite
  completa necesita `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
  `SUPABASE_SERVICE_ROLE_KEY`.

## 11. Auditorías (2026-11-28)

Tres revisiones en paralelo, sobre el diff del sprint y con la spec delante.

| Auditoría | Veredicto | Hallazgos corregidos |
|---|---|---|
| Seguridad (OWASP, IDOR, idempotencia, abuso) | Aprobado con observaciones; sin críticos ni altos | Bandeja sin comprobar membresía (fuga de `taskTitle`/`groupName` a un expulsado); `todo_idempotency` sin caducidad; `updateTask` sin validar notas/categoría; fechas de zona inválidas en `updateGroup` |
| Calidad | Cambios mayores: 3 altos | `reopen` devolvía tarea parcial; receptor del push sin bypass de Vercel y `Toast` fuera del hilo principal; «Borrar» visible en tareas ajenas; `request_ttl_hours` y `default_power` sin cablear; `removeMember` sin caducar solicitudes ni avisar; etiquetas de avisos y widget sin traducir; `assigneeName` vacío en las escrituras |
| Estilo | Cambios en docs y tres puntos Kotlin | Cifras y estados desactualizados (26 operaciones, 12 eventos, plan aprobado), `TODO` como nombre de tabla de copias, `insert(emoji)` duplicado, imports y constantes |

**Deuda aceptada, con motivo:**
- `TodoScreen.kt` orquesta el módulo en ~500 líneas con el estado en `remember`. Las pantallas ya
  están extraídas; mover el estado a un holder es un refactor que no aporta al propietario ahora y
  se hará si el módulo crece.
- El catálogo de categorías del panel no escribe auditoría porque el Core no tiene servicio de
  auditoría todavía; cuando exista, la acción lo usará.
- Los botones Aceptar/Denegar del push no se pueden probar en local (sin credenciales FCM): la
  prueba es del propietario en staging con dos móviles.
- `db-tests` no es hermético respecto a una instancia con módulos instalados o demo sembrada:
  varias pruebas cuentan filas del registro/catálogo. La verificación completa se hace con la
  instancia limpia (módulo desinstalado y demo borrada) y luego se reinstala. Conviene que el
  Core aísle esas pruebas del estado del entorno.

- `2026-11-28` — **paleta de emojis**: el selector de la app pasa de 18 emojis en
  una fila a 72 agrupados en seis bloques (casa y limpieza, cocina y compra,
  familia y mascotas, papeles y dinero, salud y deporte, viajes y ocio), con el
  mismo orden y los mismos grupos en el panel. En la app son chips de 42 dp con
  `surface`/`border` y etiquetas traducidas a los nueve idiomas; en el panel son
  radios nativos (sin JavaScript, el formulario sigue siendo HTML) con los tokens
  semánticos. Verificado en el emulador en claro y oscuro y en el panel con los
  dos temas; tests de la paleta en ambos lados (duplicados, máximo de ocho puntos
  de código y emoji por defecto).
