---
id: sprint-15-task-02
titulo: Core — runtime del primer módulo real
area: core
estado: pendiente
fuente: docs/ai/module-system.md; docs/superpowers/specs/2026-10-26-modulo-system.md §4; docs/superpowers/specs/2026-10-26-admin-shell.md §6; docs/superpowers/specs/2026-10-26-core-api.md §3.1
adrs: [0004, 0007]
---

**Tarea**: cerrar los huecos que impiden que un módulo real funcione (privilegios sobre el
esquema del módulo, identidad para RLS, scopes por petición, host de páginas de admin,
empaquetado de `packages/` en el bundle serverless) e implementar las dos capacidades
transversales que la v1 usa (D12): **realtime por Broadcast** y **push FCM**. El runtime de
ambas **ya existe** en el Core (`event_outbox`, `module_channels`, `core_can_subscribe`,
`packages/core/src/push/fcm.ts`); lo que falta es que un módulo pueda usarlo. Probar el ciclo
completo con un módulo de fixture.

**Alcance**
- Dentro:
  - Tras aplicar las migraciones, conceder a `service_role` y `authenticated` `usage` sobre el
    esquema `module_<key>` y DML sobre sus tablas/secuencias; el DDL del módulo sigue sin poder
    hacer `GRANT`. Verificar que antes de instalar no hay acceso y después sí.
  - **Helper de identidad para RLS de módulos**: el DDL no puede escribir `auth.uid()`
    (`assertSafeModuleSql` prohíbe el esquema `auth`) ni crear funciones `security definer`.
    Exponer una función compartida y segura que el módulo pueda usar sin cualificar
    (`core_current_user_id()` o equivalente), con `search_path` controlado, y tests de que un
    módulo no puede leer ni escribir fuera de su esquema.
  - **Contrato de widgets de dashboard (D10)**: el manifest declara `dashboard_widgets`
    (`key`, `type`, `title`, `icon`, `order`, `surface`); el módulo implementa un resolver de
    datos; `GET /api/v1/me/dashboard` compone los widgets de los módulos activos con acceso. Sin
    HTML/JS del módulo. Es un cambio `module-contract`: esquema, docs, CI y ejemplos en el mismo
    PR. El host de la app lo consume en la tarea 01/03.
  - Resolver scopes de módulo para sesiones y claves delegadas por petición: `has_module_access`
    + scopes declarados en el manifest; sin grant → 403; módulo inactivo → 403/404 uniforme.
  - Servir `packages/<key>/admin/<route>/page.tsx` en `/modules/<key>/<route>` con un registro
    estático generado en build, gate por rol (`admin`/`super_admin`) y estado `active`.
  - **Entrada del módulo (D20)**: `/modules/<key>` redirige a `/modules/<key>/overview` cuando el
    módulo está `active` y declara esa página; si no, muestra la ficha. La ficha se mueve a
    `/modules/<key>/settings` y `settings` queda **reservada** (un `admin_pages.route` con ese
    nombre falla en la validación). La lista de módulos gana las acciones **Abrir** y **Ajustes**.
  - Empaquetar los paquetes de módulo para Vercel: copia de `manifest.json`, `sql/`, `docs/`,
    `admin/`, `locales/` y assets al build, `MODULES_ROOT` y `outputFileTracingIncludes`.
  - **Canal de módulo suscribible (hueco real)**: el runtime de eventos existe
    (`event_outbox` → `publishPending` → Broadcast privado → hooks → push) y
    `core_can_subscribe(topic)` ya autoriza `realtime.messages` con la `members_fn` del canal.
    Pero esa `members_fn` se resuelve como `public.<fn>` y **el SQL del módulo no puede
    referenciar `public`** (`assertSafeModuleSql`), ni crear `security definer`. Resultado: hoy
    un módulo no puede declarar un canal que de verdad funcione. Cerrar el hueco con una de las
    dos vías, decidida en el plan: (a) el instalador crea en `public` un envoltorio
    `module_<key>_<fn>` que delega en `module_<key>.<fn>`, o (b) el manifest declara tabla y
    columna del miembro y el Core construye la consulta sin ejecutar SQL del módulo. Verificar
    que la tabla `module_channels` se rellena al instalar y se limpia al desinstalar.
  - **Settings con rango y control (D3.7)**: hoy `type: "int"` no admite `min`/`max`/`step`, y
    la página del módulo en el panel **solo muestra** los settings (`ModuleSettingCards`): no hay
    formulario de edición aunque `PATCH/PUT /api/v1/modules/<key>/settings` exista. Añadir al
    contrato `min`, `max`, `step` y un `control` (`number` | `slider`) para `int`, validar el
    rango **en servidor** (no solo en la UI) y renderizar un formulario editable con deslizador,
    accesible y con el valor actual visible. Es un cambio `module-contract`: esquema, docs,
    ejemplos, envoltorios y tests en el mismo PR.
  - **Claves foráneas de módulo a `profiles` (D16)**: `purgeUser` borra `auth.users` y solo
    pone a `null` las referencias de `public.*`; no conoce los esquemas de módulo. Si un módulo
    referencia `profiles(id)` sin `on delete set null`, el borrado definitivo de un usuario
    **falla**. Exigirlo en el contrato (validación del DDL y del manifest), documentarlo y
    probarlo en `db-tests`: instalar el fixture, crear datos que apunten a un usuario,
    purgarlo y comprobar que el borrado termina y las filas sobreviven sin `user_id`. Si el
    fixture necesita reaccionar (por ejemplo, marcar estado), evaluar un `user.purged` hook; para
    OweNo no hace falta porque el tipo se deriva.
  - **Contrato del `notify` y del payload**: `events[].notify` ya acepta `push` y el push es
    **data-only** (`key` + `payload`); la app traduce. Fijar en `docs/ai/module-system.md` el
    formato de la clave (`push.<tipo_con_puntos_a_guiones_bajos>`), el tamaño máximo del payload
    y qué eventos no deben notificar al autor. Si cambia el contrato: `manifest.schema.json`,
    ejemplos y envoltorios en el mismo PR.
  - **Verificación de push**: el envío ya está implementado (cuenta de servicio cifrada en
    settings, reintentos con backoff, revocación de tokens `UNREGISTERED`/`INVALID_ARGUMENT`).
    Aquí solo se prueba con el fixture; las **credenciales las configura el propietario** en el
    panel, no llegan por chat ni por git. Sin credenciales, `createPushFromSettings` devuelve
    `undefined` y el evento se publica igual: comprobar que no falla ni pierde el evento.
  - **No notificar al autor**: `recipients()` hoy envía a todos los miembros del canal. Un
    módulo que apunta «Ana añadió un gasto» no debe avisar a Ana. Si el payload trae `actor_id`,
    el emisor lo excluye de los tokens de push (y del canal si el contrato lo permite); test con
    dos miembros y un autor. Sin esto, cada acción propia genera una notificación al autor.
  - Fixture de módulo para `db-tests` (install → activate → endpoint con grant → evento en el
    outbox → miembro suscrito recibe → push encolado → uninstall) y tests unitarios del guard,
    del host de páginas y del canal.
- Fuera: implementar OweNo; MCP.

**Dependencias**: ninguna. Puede ejecutarse en paralelo con la tarea 01. La tarea 03 depende de
esta.

**Riesgos**: el host de páginas necesita imports estáticos (Next/Turbopack no bundlea rutas
arbitrarias); los grants son una superficie de seguridad y deben ser mínimos; el guard de
módulos no debe abrir scopes de Core; el empaquetado no debe duplicar secretos ni datos.

**Criterios de aceptación**
- Un módulo de fixture se instala, activa, consulta y desinstala en `db-tests` sin tocar el
  Core manualmente.
- Un usuario con grant activo llama a un endpoint de módulo con su scope; sin grant recibe
  403; un módulo desactivado no se sirve.
- Un módulo de fixture puede escribir una política RLS con el helper de identidad y la suite
  de aislamiento demuestra que un usuario de otro grupo no ve ni modifica sus filas.
- La página de admin del fixture se renderiza en `/modules/<fixture>/<route>` solo si está
  `active` y el rol alcanza; una página de otro módulo no es accesible.
- Un módulo de fixture declara un widget, `GET /api/v1/me/dashboard` lo devuelve solo a quien
  tiene acceso y el contrato rechaza un widget con `type` desconocido o HTML; el manifest
  inválido falla en CI.
- `next build` y un preview de Vercel incluyen el paquete; instalar el fixture desde el panel
  funciona en el preview.
- El fixture declara un canal, emite un evento y un usuario miembro se suscribe en
  `realtime` a ese topic; un usuario que no es miembro no puede suscribirse
  (`core_can_subscribe` = false) y un módulo desactivado cierra el canal.
- Un usuario con datos del fixture se desactiva y se purga: el borrado termina sin error de
  clave foránea y las filas del módulo sobreviven sin `user_id`.
- La `members_fn` del fixture funciona sin que su SQL escriba en `public`: el mecanismo elegido
  (envoltorio del instalador o declaración de tabla/columna) queda probado y documentado.
- Un evento con `notify: ["push"]` resuelve los tokens de los miembros del canal y no del autor;
  sin credenciales FCM, el evento se marca `published` y no se reintenta en bucle.- Un setting `int` con `min`/`max`/`step` se edita con deslizador en la página del módulo; un
  valor fuera de rango se rechaza en el servidor con `validation_failed`, y un manifest con
  `min > max` o `default` fuera de rango falla en CI.
- `docs/ai/module-system.md`, `docs/flows/new-module.md`, `docs/api/README.md` y
  `docs/flows/cicd.md` actualizados; `docs/ai/manifest.schema.json` y ejemplos del contrato de
  widgets, de los eventos/canales, del registro de dispositivos y de los settings con rango y
  control; `docs/infrastructure.md` con
  las credenciales FCM por instancia; `AGENTS.md`, `CLAUDE.md` y envoltorios de proveedor revisados y actualizados si
  cambia el contrato (regla `module-contract` de `AGENTS.md`).
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter db-tests test` y `pnpm --filter admin build`
  en verde; CI en verde.

**Puertas de usuario**
- Aprobar el plan (spec de plataforma: los documentos citados ya están aprobados).
- Configurar Firebase en el panel (Ajustes → Notificaciones) siguiendo `/help/firebase`, o
  aceptar que el push se entrega deshabilitado y se pospone. Las credenciales no pasan por el
  chat.
- Autorizar la instalación del fixture en el preview de staging (sin datos reales).
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (grants, scopes, páginas de
módulo same-origin, empaquetado y exposición de ficheros, autorización de canales de realtime y
manejo de la cuenta de servicio FCM).
