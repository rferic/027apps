# OweNo — intake y cuestionario de módulo (borrador)

> **Estado:** borrador para el propietario. No es una spec y no hay mockup todavía. Las
> respuestas marcadas **«propuesta»** son mías y necesitan confirmación; las marcadas
> **«decisión»** bloquean la spec. Sigue el cuestionario de
> [`docs/flows/new-module.md`](../../flows/new-module.md) §1.1 y el contrato de
> [`docs/ai/module-system.md`](../../ai/module-system.md).

## Hallazgo previo: hay dos conceptos de producto

| Fuente | Qué promete |
|---|---|
| Spec de diseño `2026-10-24-027apps-design.md` §3 | **Split Expenses**: grupos de gastos, participantes, balances, liquidación óptima, importador de Splitwise, categorías, ficticios con claiming. |
| Landing actual (`/` y `/self-host`) | **Presupuestos e histórico**: ingresos y gastos, moneda y formato, presupuesto por categoría, historial. |

No son el mismo producto. Un presupuesto por categoría no necesita balances ni liquidación; un
Splitwise no necesita presupuesto mensual. La v1 no debe hacer las dos cosas.

## D2 — Decisión de producto (decidida: gastos compartidos)

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **A. Gastos compartidos** (recomendada) | Grupos, gastos, reparto, balances y «quién paga a quién». | Es la spec de diseño aprobada; el dominio es rico y testeable; sustituye Splitwise, objetivo declarado; ADR 0008 ya define dinero/fechas para esto. | La landing debe corregir «presupuestos» por «gastos compartidos»; no cubre el presupuesto mensual. |
| B. Presupuestos e histórico | Ingresos/gastos por categoría, presupuesto mensual, gráficos. | Coincide con la landing actual; más simple de explicar. | No resuelve «quién debe a quién»; el dominio es más plano; no usa el modelo de participantes que previó el diseño. |
| C. Ambos en v1 | Gastos compartidos + presupuesto. | Producto completo. | Demasiado grande para una v1; dos modelos de datos y dos UX; retrasa la validación del runtime. |

**Recomendación: A.** Si se elige A, la landing se corrige en el mismo PR de la tarea 03 y el
módulo se llama OweNo (D4, decidido).

## Cuestionario (fases 1–5)

### Intake

| # | Pregunta | Respuesta propuesta |
|---|---|---|
| 1 | ¿Cuál es la idea? | Las cuentas compartidas de la familia: quién pagó qué, cuánto debe cada uno y cómo se salda, sin hoja de cálculo. |
| 2 | ¿Qué necesidad cubre? | Sustituir Splitwise/Excel y evitar discusiones por cuentas pendientes; una sola instancia privada, sin anuncios. |
| 3 | ¿Qué funcionalidades debe tener? | Grupos (casa, viaje, evento), miembros registrados y ficticios, categorías, gastos con **reparto igual o importes exactos por persona**, balances por miembro, liquidación e historial. |
| 4 | ¿Cuál es el concepto general? | Cada grupo es un libro de cuentas con su moneda; los gastos son inmutables y las correcciones se hacen con un gasto o una liquidación nueva. |

### Ejemplos

| # | Pregunta | Respuesta propuesta |
|---|---|---|
| 5 | ¿Apps similares? | Splitwise, Tricount, Settle Up. |
| 6 | ¿Qué hacen bien y qué mal? | Bien: añadir gasto en dos toques, balance a la vista, «settle up». Mal: anuncios/paywalls, cuentas obligatorias, repartos complejos y multi-divisa que confunden. |
| 7 | ¿Qué patrones se reutilizan? | Reparto igual por defecto, balance por persona, liquidación con el mínimo de movimientos (lo que no hacen los rivales), historial legible. No se copian: OCR de recibos, sincronización bancaria, conversión de divisas. |

### Identidad y manifest

| # | Pregunta | Respuesta propuesta |
|---|---|---|
| 8 | ¿Nombre? | **OweNo** (elegido 2026-11-12). `key: owe-no`; tagline *Who owes what, settled.* / *Shared expenses, no drama.* |
| 9 | ¿Icono/logo? | SVG monocromo `currentColor`, cartera/monedas; se dibuja en el PR si se aprueba la identidad. |
| 10 | ¿Propiedades? | `key: owe-no`; `name: OweNo`; `branding.icon: assets/icon.svg` (billete); `branding.color: emerald`; `version: 1.0.0`; `is_public: false` (se concede a la familia); `i18n`: los 9 locales. |

### Análisis y enriquecimiento

| # | Pregunta | Respuesta propuesta |
|---|---|---|
| 11 | ¿La propuesta cubre lo necesario? | Para v1, sí. Se sugiere añadir «grupo archivado» y «miembro inactivo» para no borrar historial. |
| 12 | ¿Mejoras a incluir/descartar? | Incluir: categorías por grupo, filtro por fecha, resumen por categoría. Descartar: presupuestos, multi-divisa, recibos, recurring, banco. |
| 13 | ¿Encaja con el Core? | Tabla propia `owe_no_members` (el Core no tiene `group_members` ni `participants`), con FK **opcional** a `profiles.id` para el miembro registrado; los ficticios no tienen usuario. Los grupos y categorías también son tablas del módulo. No reabre el Core. |

### Cierre de requisitos

| # | Pregunta | Respuesta propuesta |
|---|---|---|
| 14 | Límites de v1 y no-objetivos | Ver «Límites v1» abajo. |
| 15 | Tablas, UI, scopes, settings, eventos, locales, moneda, `is_public` | Ver «Modelo y superficie» abajo. |
| 16 | Dependencias del Core | Instalador (existe), `/me/modules` (tarea 01), runtime de módulos (tarea 02), RLS suite (existe), DS (existe), i18n (existe), host de admin (tarea 02), empaquetado Vercel (tarea 02). |

## Límites v1 (propuesta)

**Dentro**
- Grupos con nombre, moneda y estado (activo/archivado).
- **Ciclo de vida del grupo (D15)**: cualquier usuario crea un grupo desde la app; los admins
  también crean y editan grupos desde el panel. El **creador invita**, y el invitado **tiene que
  aceptar** antes de ver el grupo. El creador puede **echar** (quitar) y **bloquear** (no se le
  puede volver a invitar). Si alguien **sale**, deja de ver y de poder tocar el grupo, pero el
  **registro de movimientos se conserva siempre**: no se borra nada de lo ocurrido.
- Miembros registrados (enlace a `profiles`) y ficticios (solo nombre), con **enlace manual por un
  admin**; sin claiming automático. Un ficticio no acepta nada: es un marcador histórico.
- **Borrado definitivo de un usuario (D16)**: si un usuario se borra de la base de datos, su
  miembro en OweNo **pasa a ficticio** conservando el `display_name` y todo el historial; las
  deudas siguen ahí. Ninguna pantalla depende de la fila de `profiles` para nombrar a nadie.
- Categorías por grupo.
- Gastos con descripción, importe, fecha de calendario, pagador, categoría y **reparto igual o
  importes exactos por persona** (sin porcentajes ni pesos en v1). **Participantes por gasto**
  (D17): en un grupo de cinco, tres helados se dividen entre tres; el pagador puede no participar
  y hace falta al menos un participante, siempre `active`.
- Balances por miembro y liquidación con el **mínimo exacto de transferencias** (D3.6, B): no
  el voraz `n−1`, sino el óptimo. Se calcula sobre los saldos en unidades menores (enteros, sin
  redondeos) con una DP de subconjuntos de suma cero; el resultado se ordena con desempate fijo
  para que sea **determinista** (mismos saldos → mismas transferencias). Test de fuerza bruta
  como oráculo en grupos pequeños y casos con saldos repetidos. **Tope configurable** (D3.7):
  setting del módulo `settlement_exact_limit` (`int`, mínimo 4, máximo 20, defecto 12) que se
  ajusta con un **deslizador** en la configuración del módulo en el panel. Por encima del valor
  configurado se degrada a voraz con aviso explícito en la UI. El cálculo es propio, sin
  dependencia externa: no hay paquete mantenido que resuelva el mínimo exacto (investigado
  2026-11-12; el voraz que publican casi todos no es el mínimo).
- Historial de gastos y liquidaciones; correcciones con movimientos nuevos.
- **Importador de Splitwise (CSV) en v1 en la app**, para el **creador del grupo**: preview/dry-run, mapeo de identidades y commit; **CSV por grupo** (sin Pro: no JSON/API); **rechaza multi-divisa con aviso**; pagos como liquidaciones; autoenlace por **nombre exacto y único**; sin coincidencia → **selector de usuarios activos** (id + nombre, sin email) o **crear ficticio**; fusión de identidades del mismo usuario. **El CSV no trae emails**, así que no hay autoenlace por email. El backend expone el endpoint; el panel solo tiene el enlace manual de ficticios (admin). Coherencia con D15: si el importador enlaza un **usuario registrado** que no es miembro, se le envía **invitación** (acepta y entonces ve su historial); los **ficticios** son marcadores y no aceptan nada.
- Panel: overview del grupo, gastos, balances y miembros.
- **Realtime y notificaciones (D12)**: OweNo declara `channels` y `events`; el servidor publica
  en el topic privado del grupo (Supabase Broadcast) y envía push FCM data-only. El runtime ya
  existe; falta que el canal de módulo sea suscribible (tarea 02) y el cliente en la app
  (tarea 04).

**Fuera**
- Presupuestos mensuales.
- Multi-divisa completa, tipos de cambio y conversión.
- Fotos de recibo, OCR, recurrencia, sincronización bancaria.
- Nada más de realtime/push: son capacidades del Core (D12); OweNo solo declara sus `channels` y `events` en el manifest.
- Claiming automático de miembros ficticios (el enlace manual por admin sí entra).

> Investigación de formatos y límites: [`splitwise-export.md`](splitwise-export.md).

## Modelo y superficie (propuesta)

> **Grupos (decidido 2026-11-12):** las categorías del Core (`user_categories`) solo etiquetan y
> dan acceso; todos los miembros ven a todos. Los grupos de OweNo son **de OweNo** y no
> hay un selector global de grupo en el esqueleto de la app. El grupo se elige dentro del módulo.

### Tablas (esquema `module_owe_no`, todas con `group_id`)

- `owe_no_groups` — `id`, `name`, `currency`, `archived_at`, `created_by` (`on delete set
  null`), timestamps.
- `owe_no_members` — `id`, `group_id`, `user_id` (nullable, `on delete set null`),
  `display_name` (**copiado, nunca un join a `profiles`**), `state`
  (`invited`|`active`|`left`|`removed`), `invited_by`, `invited_at`, `joined_at`, `left_at`.
  `kind` **se deriva**: `user_id is null` → ficticio, así que el borrado definitivo del usuario
  convierte el miembro en ficticio sin ninguna escritura extra. El bloqueo va aparte:
- `owe_no_blocks` — `id`, `group_id`, `user_id`, `blocked_by`, `created_at`; un bloqueado no
  puede ser invitado ni reactivado.
- `owe_no_categories` — `id`, `group_id`, `name`, `color_slot`, timestamps.
- `owe_no_movements` — `id`, `group_id`, `kind` (`expense`|`settlement`), `description`,
  `amount_minor`, `currency`, `paid_by_member_id`, `category_id`, `occurred_on` (date),
  `created_by`/`updated_by`/`deleted_by` (`on delete set null`), `deleted_at`, timestamps.
  **Un solo tipo de hecho (D19)**: un gasto y un pago cambian la dirección, no la entidad.
- `owe_no_movement_shares` — `movement_id`, `member_id`, `amount_minor`; PK compuesta; **solo
  existen filas de los participantes**; la suma debe ser el total. En una **liquidación** hay
  **una sola** fila: la del receptor, por el total. El pagador no necesita fila, y «pago la
  compra» es un `expense` (una o varias filas), no una liquidación.

Sin `group_id` en `owe_no_movement_shares` (se deriva del movimiento), pero la RLS la resuelve por
el grupo del gasto; el test de aislamiento lo cubre.

**Regla de claves foráneas a `profiles` (D16).** Toda FK de una tabla de módulo a `profiles(id)`
va con `on delete set null`, porque `purgeUser` borra `auth.users` y solo limpia las tablas de
`public`. Sin esa regla, borrar un usuario **falla** por clave foránea. La tarea 02 lo exige en
el contrato y lo prueba con el fixture; la 03 lo prueba con OweNo.

### API `/api/v1` (propuesta)

| Método y ruta | Acción | Scope |
|---|---|---|
| `GET /owe-no/groups` | grupos del usuario | `expenses:read` |
| `POST /owe-no/groups` | crear grupo | `expenses:read_write` |
| `GET /owe-no/groups/{id}` | detalle + miembros | `expenses:read` |
| `PATCH /owe-no/groups/{id}` | nombre, moneda, archivar | `expenses:read_write` |
| `GET/POST /owe-no/groups/{id}/members` | listar miembros / invitar (creador; el invitado acepta) | `expenses:read` / `read_write` + creador |
| `GET /owe-no/invitations` | invitaciones pendientes del usuario | `expenses:read` |
| `POST /owe-no/invitations/{id}/accept` | aceptar la invitación | `expenses:read_write` |
| `POST /owe-no/invitations/{id}/decline` | rechazar la invitación | `expenses:read_write` |
| `DELETE /owe-no/groups/{id}/members/{memberId}` | echar a un miembro (creador) | `expenses:read_write` + creador |
| `POST /owe-no/groups/{id}/members/{memberId}/block` | bloquear (creador) | `expenses:read_write` + creador |
| `POST /owe-no/groups/{id}/leave` | salir del grupo (conserva el historial) | `expenses:read_write` |
| `POST /owe-no/groups/{id}/members/{memberId}/link` | enlazar un ficticio con una cuenta (admin; conserva historial) | `expenses:read_write` + admin |
| `POST /owe-no/imports/splitwise` | preview/dry-run y commit de un export CSV (app; creador del grupo) | `expenses:read_write` + creador del grupo |
| `GET /owe-no/groups/{id}/linkable-users` | usuarios activos para enlazar una identidad importada (id + display_name) | `expenses:read_write` + creador del grupo |
| `GET/POST /owe-no/groups/{id}/categories` | categorías | `expenses:read` / `read_write` |
| `GET/POST /owe-no/groups/{id}/movements` | historial / alta de gasto o pago | `expenses:read` / `read_write` |
| `PATCH /owe-no/groups/{id}/movements/{id}` | editar (autor o creador) | `expenses:read_write` |
| `DELETE /owe-no/groups/{id}/movements/{id}` | baja lógica (autor o creador) | `expenses:read_write` |
| `GET /owe-no/groups/{id}/balances` | balances | `expenses:read` |

Paginación, filtros por fecha/categoría, idempotencia en escrituras y envelope ADR 0007.

### Manifest (propuesta)

- `scopes`: `expenses:read`, `expenses:read_write`, `balances:read`.
- `mcp_tools`: `expenses_list` y `balances_get` (`kind: read`); ninguna `write` expuesta.
- `settings`: categoría `owe_no`, `default_currency` (hereda la de la instancia) y
  `settlement_exact_limit` (`int`, `min: 4`, `max: 20`, `step: 1`, defecto 12, con deslizador en
  el panel), `is_public: false`, `mcp_access: read`. Requiere que el contrato de settings acepte
  rango y control (tarea 02).
- `events`/`channels`: **sí** (D12). Canales por grupo con la `members_fn` que aporta el Core
  (el DDL del módulo no puede declarar `security definer`); eventos `owe_no.movement_created`,
  `owe_no.movement_updated`, `owe_no.movement_deleted` y `owe_no.member_linked` (el `type` no
  admite guiones; el prefijo del módulo va con guion bajo), con `notify: ["push"]` en los tres
  primeros. El runtime de eventos, Broadcast y push ya existe en el Core; la tarea 02 cierra el
  canal de módulo y lo prueba con el fixture.
- `admin_pages`: `overview`, `groups` e `imports` (`admin`), servidas dentro de Plataforma → Módulos.
- `dashboard_widgets`: propuesta `owe-no.summary` (surface `app`) y `owe-no.metric`
  (surface `panel`), pendiente de D10: título, icono, orden y datos de saldo/actividad del grupo
  activo; sin HTML. El contrato exacto lo fija la tarea 02. Un módulo puede aportar app, panel,
  ambos o ninguno; cada superficie tiene su propio tipo/componente.
- `docs`: readme, api, settings (no mcp/events si no se declaran tools/canales; si se declaran
  tools, `docs/mcp.md` es obligatorio).

### Fechas y dinero

- Importes en **enteros de céntimos** (`amount_minor`), nunca `float`.
- Fecha del gasto como `date` de calendario (`spent_on`), no un instante convertido.
- Moneda por grupo; la instancia aporta la moneda por defecto (ADR 0008).

## Mockups (F1 y F2) — qué debe verse antes de escribir DDL

El mockup A del **esqueleto base** se aprueba en la tarea 01 (`docs/mockups/app-shell/`). Sobre
ese esqueleto se construyen dos artefactos en `docs/mockups/owe-no/index.html`:

**F1 — móvil (390 px).** El mismo home aprobado, con OweNo dentro:
- Home/dashboard con el **widget de OweNo** incrustado (resumen del grupo activo) y el resto
  de widgets/módulos. Sin selector global de grupo: el grupo se elige dentro de OweNo.
- Lista de grupos (vacía, con grupos, cargando, error).
- Detalle del grupo: balances por miembro y gastos recientes.
- Alta de gasto: importe, fecha, pagador, categoría, **reparto igual o importe exacto por persona**;
  validación y estado de
  guardado.
- Liquidación: a quién se paga, importe sugerido, confirmación.
- Historial y detalle de un gasto.
- Claro y oscuro; copy en español para revisión; 9 idiomas en la implementación.

**F2 — panel de control (1440 px).** Las pantallas de administración del módulo:
- Catálogo de módulos y ficha del módulo (instalar/activar/desactivar, grants, settings).
- Overview del módulo: grupos, total, actividad reciente.
- Detalle de grupo: gastos, balances, miembros.
- Categorías y miembros del grupo.
- Claro y oscuro; datos de demo.

**D9:** si el propietario quiere además una sección nueva «App» dentro del panel que
previsualice las pantallas móviles, se añade a C; hoy el panel no tiene esa sección y no se
inventa.

## Preguntas que necesitan respuesta antes de la spec

1. **D2**: gastos compartidos (decidido 2026-11-12).
2. **D3**: límites v1. Ficticios: enlace manual por admin, sin claiming automático (decidido 2026-11-12). Importador en v1 en la app, solo CSV (D3.2, D3.4); multi-divisa se rechaza (D3.3); reparto igual o importes exactos (D3.5). Liquidación: mínimo exacto con tope configurable (D3.6, D3.7); salir exige saldo cero y el creador puede echar con saldo pendiente (D3.9, A). Realtime y push: decisión D12 (C), con credenciales FCM pendientes. Presupuestos y recibos: fuera (D3.8, A).
3. **D4**: nombre elegido: **`owe-no` / «OweNo»**.
4. **Presupuestos y recibos**: fuera de v1 (D3.8, A). Sin presupuestos, sin fotos de recibo,
   sin OCR, sin recurrencia y sin sincronización bancaria.
5. **Ciclo de vida del grupo**: decidido (D15). Cualquier usuario crea desde la app, el admin
   también desde el panel, el creador invita y el invitado acepta, y puede echar y bloquear.
6. ¿Los datos de demo para la captura real los preparo yo (familia ficticia, importes
   inventados) y los apruebas antes de publicar?
7. **D9**: decidido. Solo páginas del módulo; no hay sección «App» en el panel.

## Nota de proceso

D3, D9, D15 y D16 están cerrados. La **spec** ([`2026-11-13-owe-no.md`](../../superpowers/specs/2026-11-13-owe-no.md))
y los **mockups** ([`docs/mockups/owe-no/`](../../mockups/owe-no/index.html), F1 móvil y F2
panel) están **en borrador, pendientes de aprobación**. Los mockups **reutilizan** el esqueleto
A aprobado en la tarea 01; si obligan a cambiar la navegación, se vuelve a la puerta del mockup
A. Sin spec y sin mockups aceptados no hay plan ni DDL. La landing se actualiza en el mismo PR:
`in-development` al terminar la tarea 03 y `available` con captura real cuando la tarea 04 esté
aceptada.
