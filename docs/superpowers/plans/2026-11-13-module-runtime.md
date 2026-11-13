# Sprint 15 — Runtime de módulos: instalación, panel, realtime y demo (plan)

**Goal:** dejar el runtime de módulos listo para OweNo en cuatro entregas con puerta propia:
instalación segura y scopes (02), host de panel, ajustes y empaquetado (03), realtime y push (04)
y datos de demo (05). Cada sección se acepta sola y comparte un único módulo de fixture.
**Specs:** [`module-system.md`](../../ai/module-system.md),
[`2026-10-26-modulo-system.md`](../specs/2026-10-26-modulo-system.md) §4 y §6,
[`2026-10-26-admin-shell.md`](../specs/2026-10-26-admin-shell.md) §6,
[`2026-10-26-core-api.md`](../specs/2026-10-26-core-api.md) §3.1.
**Tareas:** [`task-02`](../../tasks/sprint-15-app-y-finanzas/task-02.md),
[`task-03`](../../tasks/sprint-15-app-y-finanzas/task-03.md),
[`task-04`](../../tasks/sprint-15-app-y-finanzas/task-04.md),
[`task-05`](../../tasks/sprint-15-app-y-finanzas/task-05.md).
**Decisiones:** D10, D12, D13, D16, D20 y D21 del
[README del sprint](../../tasks/sprint-15-app-y-finanzas/README.md).

> **Orden:** 02 → 03 → 04 → 05. La 04 puede ir en paralelo con la 03; la 05 necesita la ficha de
> la 03. Cada parte tiene su propia lista de aceptación; no se cierra una para abrir la
> siguiente. El módulo de fixture (`packages/fixture/`, clave `fixture`) es el banco de pruebas de
> las cuatro y **no** es producto: no se publica en el catálogo ni se instala en producción.

## Precondiciones (puertas)

- [ ] El propietario **aprueba este plan**.
- [ ] Rama `sprint/15-app-and-oweno` (ya creada) y PR #97 en draft.
- [ ] Ningún módulo de terceros instalado en staging: el runtime se estrena aquí.
- [ ] Para la prueba real de push: Firebase configurado en el panel (Ajustes → Notificaciones).
      Sin credenciales, la 04 se acepta con el envío deshabilitado y el evento publicado.
- [ ] Acceso a staging y autorización para instalar el fixture.

## Paso 0 — Arranque

- [ ] Poner `task-02.md` en `estado: en curso` al primer commit de la parte 02; cada tarea pasa a
      `test` al terminar su parte, no antes.
- [ ] No mezclar cambios ajenos: el resto del árbol ya está commiteado en esta rama.

## Parte 02 — Instalación, aislamiento y scopes

**Cierra:** `task-02.md`. **Fuera:** panel, widgets, settings, canal, demo.

### 2.1 Privilegios del esquema

- [x] Test rojo en `db-tests`: antes de instalar, `module_<key>` no existe; tras instalar,
      `authenticated` puede leer/escribir solo lo que la RLS permite y `service_role` puede todo;
      el DDL del módulo sigue sin poder `grant`.
- [x] Implementar los grants en la misma transacción de la instalación: `usage` del esquema y
      DML mínimo sobre tablas y secuencias; `revoke` en la desinstalación.
- [x] Verificar que el instalador **no** concede `create` sobre el esquema a `authenticated`.

### 2.2 Identidad para RLS

- [x] Test: una política del fixture con `core_current_user_id()` aísla filas por usuario.
- [x] Crear la función compartida con `search_path` fijo y sin acceso a otros esquemas; `grant
      execute` a `authenticated` y `service_role`.
- [x] `assertSafeModuleSql` sigue prohibiendo `auth.` y `security definer`; el fixture usa el
      helper y pasa la validación.

### 2.3 Scopes por petición

- [ ] Tests: sesión con grant y scope → 200; sin grant → `403`; módulo inactivo → `403`/`404`
      uniforme; clave delegada con scopes de Core no abre scopes de módulo.
- [ ] Resolver por petición con `has_module_access` + scopes del manifest; cachear por petición,
      no entre usuarios.
- [ ] El guard de Core no cambia su comportamiento sin módulo.

### 2.4 Claves foráneas y purga (D16)

- [x] Test en `db-tests`: el fixture apunta a `profiles(id)` con `on delete set null`; se
      desactiva y purga al usuario y el borrado termina sin error; las filas sobreviven sin
      `user_id`.
- [x] Validación en la instalación: una FK de módulo a `profiles` sin `on delete set null` falla
      el instalador con un mensaje claro.
- [ ] Documentar la regla en `module-system.md`.

### 2.5 Módulo de fixture

- [ ] `packages/fixture/` con `manifest.json` (`key: fixture`), `sql/` (tabla, RLS con el helper,
      FK a `profiles`), un endpoint de prueba y `docs/` mínimos.
- [ ] Test de ciclo: install → activate → endpoint con scope → uninstall, sin tocar `public` a
      mano.

### 2.6 Documentación

- [ ] `docs/ai/module-system.md`, `docs/flows/new-module.md` y `docs/api/README.md` con grants,
      helper, scopes y la regla de FK.

## Parte 03 — Host de panel, ajustes y empaquetado

**Cierra:** `task-03.md`.

### 3.1 Host de páginas de admin

- [ ] Test rojo: una página del fixture se sirve en `/modules/fixture/<route>` solo si está
      `active`, el rol alcanza y la ruta está declarada; otra ruta da 404.
- [ ] Registro **estático** generado en build (Next/Turbopack no bundlea rutas arbitrarias): un
      mapa `key/route → import()` generado por script y comprobado en CI.
- [ ] Gate por rol (`admin`/`super_admin`) y estado, reutilizando el guard.

### 3.2 Entrada del módulo (D20)

- [ ] `/modules/<key>` redirige a `overview` si el módulo está `active` y declara esa página; si
      no, muestra la ficha.
- [ ] La ficha pasa a `/modules/<key>/settings`; `settings` queda **reservada**: un manifest con
      `admin_pages.route: "settings"` falla en la validación y en CI.
- [ ] La lista de módulos gana **Abrir** y **Ajustes**; los enlaces conservan el rol.

### 3.3 Widgets de dashboard (D10)

- [ ] Test: manifest con `dashboard_widgets` válido; `type` desconocido o HTML → error de
      validación.
- [ ] `GET /api/v1/me/dashboard` compone los widgets de módulos activos **con acceso**; sin
      acceso no aparece; sin datos, el widget no inventa cifras.
- [ ] Render nativo en el panel; la app lo consume por el contrato (tarea 07).

### 3.4 Settings con rango y control (D3.7)

- [ ] Test: `min > max`, `default` fuera de rango o `control` desconocido → manifest inválido.
- [ ] `min`/`max`/`step`/`control` (`number`|`slider`) para `int`; validación **en servidor** en
      `PATCH/PUT /modules/<key>/settings` con `validation_failed`.
- [ ] Formulario editable en la página del módulo (hoy solo muestra valores): deslizador
      accesible, valor actual visible, guardar y revertir; `is_secret` nunca se muestra.

### 3.5 Empaquetado serverless

- [ ] Copiar `manifest.json`, `sql/`, `docs/`, `admin/`, `locales/` y assets al build;
      `MODULES_ROOT` y `outputFileTracingIncludes` en `next.config.ts`.
- [ ] Test de build: el paquete del fixture aparece en el bundle; instalar desde el panel
      funciona en un preview de Vercel.
- [ ] No se copian secretos ni `.env`.

### 3.6 Documentación y contrato

- [ ] `module-system.md`, `manifest.schema.json`, `new-module.md`, `cicd.md`, `AGENTS.md`,
      `CLAUDE.md` y envoltorios si cambia el contrato (regla `module-contract`).
- [ ] Ejemplos de widgets y de settings con rango.

## Parte 04 — Realtime, canales y push

**Cierra:** `task-04.md`.

### 4.1 Canal de módulo suscribible

- [ ] Test rojo: el fixture declara un canal; un miembro se suscribe y recibe; un no miembro no
      puede; un módulo desactivado cierra el canal.
- [ ] Elegir e implementar el mecanismo: **envoltorio en `public`** que crea el instalador
      (`module_<key>_<fn>(topic text) returns setof uuid`, `security definer`, `search_path`
      fijo) y que delega en `module_<key>.<fn>`; se borra al desinstalar. Alternativa si el
      envoltorio no convence: declarar tabla y columna del miembro en el manifest y construir la
      consulta en el Core.
- [ ] `module_channels` se rellena al instalar y se limpia al desinstalar; test de ambos.

### 4.2 Contrato del evento y del push

- [ ] Fijar en `module-system.md` la clave de push
      (`push.<tipo_con_puntos_a_guiones_bajos>`), el tamaño máximo del payload y qué eventos no
      notifican al autor. `manifest.schema.json` si cambia.
- [ ] Test: un evento sin `notify` no genera push; con `notify: ["push"]` sí.

### 4.3 No notificar al autor

- [ ] Test rojo: dos miembros y un autor; el push resuelve los tokens del otro y **no** los del
      autor.
- [ ] `recipients()` excluye `actor_id` del payload; si el evento no lo trae, se comporta como
      hoy.
- [ ] Sin credenciales FCM: el evento se marca `published`, no hay bucle de reintentos.

### 4.4 Documentación

- [ ] `module-system.md` (canales, eventos, push), `infrastructure.md` (credenciales FCM por
      instancia) y `docs/flows/fcm-validation.md` si cambia el runbook.

## Parte 05 — Datos de demo (D21, B)

**Cierra:** `task-05.md`.

### 5.1 Ajuste y gate

- [ ] Test: `demo.enabled` apagado → `POST /api/v1/demo` responde `403` y la tarjeta no aparece;
      instancia marcada como producción → también se rechaza.
- [ ] Ajuste `demo.enabled` (bool, por defecto `false`) en el catálogo del Core; la detección de
      producción no se basa en el host.

### 5.2 Dataset del Core

- [ ] Test: la siembra crea usuarios con ids estables (`demo.ana@example.test`…), categorías e
      invitación; ejecutarla dos veces **no duplica**.
- [ ] `POST /api/v1/demo` y `DELETE /api/v1/demo` (admin), en transacción; el borrado se niega
      mientras un módulo declare datos enlazados.
- [ ] **Sin email**: las invitaciones de demo quedan marcadas como no enviadas y no llaman a
      Resend; test con el puerto de email espiado.

### 5.3 Contrato del módulo

- [ ] `demo: { seed_fn, clear_fn }` en el manifest; ambos o ninguno; nombres `snake_case`.
- [ ] El Core ejecuta `seed_fn(ids jsonb)` al instalar demo y `clear_fn()` al borrar y al
      desinstalar el módulo, antes de borrar el esquema; test del orden.
- [ ] Fixture con `seed_demo`/`clear_demo`: siembra, segunda siembra sin duplicar, borrado limpio.

### 5.4 UI y documentación

- [ ] Tarjeta «Datos de demo» en la ficha del módulo, solo con `demo.enabled` y dataset
      existente; instalar/borrar con confirmación y estado.
- [ ] `module-system.md` (bloque `demo`), `manifest.schema.json`, `new-module.md`,
      `infrastructure.md` y envoltorios.

## Verificación completa antes de `test`

```bash
pnpm lint
pnpm tsc
pnpm test
pnpm --filter db-tests test
pnpm --filter admin build
pnpm i18n:check
pnpm check:openapi
```

- [ ] Todo en verde, con la salida leída.
- [ ] Instalar, activar, usar y desinstalar el fixture en staging; `down` reversible.
- [ ] Preview de Vercel con el paquete incluido y las páginas sirviéndose.
- [ ] Siembra y borrado de demo en staging; ningún email enviado.

## Aceptación manual (propietario)

- [ ] Instalar el fixture desde el panel y ver su página; desinstalarlo.
- [ ] Abrir `/modules/fixture` y comprobar que lleva al resumen; la ficha en `/settings`.
- [ ] Mover el deslizador de un setting, guardar y recargar; probar un valor fuera de rango por
      API.
- [ ] Ver el widget del fixture en el Dashboard del panel.
- [ ] Publicar un evento del fixture desde su página y comprobar que llega (o que queda
      `published` sin credenciales).
- [ ] Purgar un usuario del fixture y ver que su fila sobrevive sin `user_id`.
- [ ] Instalar y borrar los datos de demo; comprobar que no hay emails y que no quedan huérfanos.

## Revisión, QA y auditoría de seguridad

- [ ] Revisión de código y auditoría **incondicional** por parte: grants y aislamiento (02),
      páginas same-origin y secretos (03), canales y push (04), gate de producción y datos
      personales ficticios (05).
- [ ] `docs/conventions/definition-of-done.md` antes de `finalizada` en cada tarea.
- [ ] Orden explícita del propietario para el merge; nada de squash sin permiso.

## Rollback

- [ ] Desinstalar el fixture deja el esquema limpio y sin filas en `module_channels` ni funciones
      envoltorio en `public`.
- [ ] Desactivar `demo.enabled` apaga la tarjeta sin borrar datos; `DELETE /api/v1/demo` limpia.
- [ ] Si el host de páginas falla en producción, desactivar el módulo (deja de servirse) sin
      tocar el Core.

## Puertas de usuario (resumen)

1. Aprobar este plan.
2. Autorizar el fixture en staging y en el preview.
3. Configurar Firebase o aceptar el push deshabilitado.
4. Aprobar la siembra de demo en staging (nunca en producción).
5. Orden explícita de merge por tarea.
