# Estado de creación del módulo `todo`

> Plantilla de `new-module`. Es la memoria del proceso: si una sesión se interrumpe, el
> siguiente agente continúa desde aquí. No sustituye a la spec ni al plan.

**Módulo:** `todo` — NotNow
**Fecha de inicio:** 2026-11-27
**Última actualización:** 2026-11-27
**Estado:** `implementacion` (tarea 01 en curso)
**Siguiente paso:** tarea 03 — dominio de tareas.

## 1. Brief

- **Idea:** post-its de tareas dentro de grupos que crea el propio usuario, más una carpeta
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
- **Icono/logo:** **A · lista con checks** (elegido por el propietario el 2026-11-27). Rejilla
  24×24, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, extremos redondeados:
  tres filas de check + línea (`M4 7l1.7 1.7L9 5.4` / `M12 7.5h8`, repetido en `12.5` y `18`).
- **Branding:** `color: indigo` (`--module-indigo`, `#4f46e5` / `#818cf8`); descripción en
  inglés por redactar en el manifest
- **Manifest borrador:** pendiente
- **Validación contra el esquema:** pendiente

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
  la carpeta personal entre las opciones y la última usada preseleccionada). Desde dentro de un
  grupo, el grupo se deduce y el formulario no pregunta. Se declara como `app_actions: new_task`.
- **Grupo:** lo crea un usuario y él gestiona sus miembros (añadir y echar). El admin de la
  instancia puede verlo y tocarlo todo desde el panel.
- **Carpeta personal:** cada usuario tiene un grupo de uno, sin miembros y **sin power**. No
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
  infinito, el grupo cierra temporada a mano cuando quiera. La carpeta personal no juega.
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
- **`is_public`: `true`** — es de la familia; cualquiera tiene su carpeta personal y puede crear
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
| Push con acciones (botones) en la notificación | **pendiente** | la solicitud se queda en «push que abre la app» |

## 7. Artefactos

- **Spec:** `docs/superpowers/specs/2026-11-27-todo.md` — **borrador para aprobación**
- **Mockup:** `docs/mockups/todo/index.html` — **borrador para aprobación** (7 pantallas de móvil y 2 del panel)
- **Plan:** `docs/superpowers/plans/2026-11-27-todo.md` — **aprobado 2026-11-27**
- **Paquete:** `packages/todo/` — pendiente

## 8. Puertas

- [ ] Requisitos cerrados por el usuario.
- [ ] ¿Empezamos el spec? — respuesta explícita.
- [ ] Spec + mockup aceptados por el usuario.
- [ ] Plan aprobado por el usuario.
- [ ] UI aceptada (si aplica).
- [ ] Aceptación del resultado y orden de merge.

## 9. Dudas abiertas

- Ninguna bloqueante. Los defaults de §5 se confirman o se corrigen en la puerta de requisitos.
- Los **botones en la notificación** dependen de una capacidad del Core que no existe todavía:
  se puede entregar la solicitud con push que abre la app y añadir las acciones después, o
  incluir esa capacidad en el sprint.

## 10. Bitácora

- `2026-11-27` — intake, referencia legacy, concepto del propietario y cuatro tandas de
  preguntas. Cerradas: grupos propios, carpeta personal sin power, power por grupo y aislado,
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
  (grupos, miembros, carpeta personal idempotente, echar libera tareas y caduca solicitudes),
  con `todo-group_members`/`todo_groups` cualificados por esquema. `db-tests` en 356.
