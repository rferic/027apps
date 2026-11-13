---
id: sprint-15-task-04
titulo: Módulo — realtime, canales y push
area: core
estado: pendiente
fuente: docs/ai/module-system.md; packages/core/src/realtime/service.ts; docs/flows/fcm-validation.md
adrs: [0007]
---

**Tarea**: que un módulo pueda emitir eventos que de verdad lleguen: canal suscribible por grupo,
autorización de `realtime.messages`, push a los miembros correctos y nunca al autor. El runtime
del Core ya existe; falta cerrar el canal de módulo y fijar el contrato.

**Alcance**
- Dentro:
  - **Canal de módulo suscribible (hueco real)**: `module_channels.members_fn` se resuelve como
    `public.<fn>`, pero el SQL del módulo no puede referenciar `public` ni crear `security
    definer`. Cerrar con una vía, decidida en el plan: (a) el instalador crea un envoltorio en
    `public` que delega en `module_<key>.<fn>`, o (b) el manifest declara tabla y columna del
    miembro y el Core construye la consulta. Verificar que `module_channels` se rellena al
    instalar y se limpia al desinstalar.
  - **Contrato del `notify` y del payload**: `events[].notify` acepta `push`; el push es
    **data-only** (`key` + `payload`) y la app traduce. Fijar la clave
    (`push.<tipo_con_puntos_a_guiones_bajos>`), el tamaño máximo y qué eventos no notifican al
    autor. Cambio `module-contract` si toca esquema.
  - **No notificar al autor**: `recipients()` hoy envía a todos los miembros del canal. Si el
    payload trae `actor_id`, el emisor lo excluye de los tokens de push. Test con dos miembros y
    un autor.
  - **Verificación de push**: el envío ya está (cuenta de servicio cifrada, reintentos,
    revocación de tokens). Se prueba con el fixture; sin credenciales, `createPushFromSettings`
    devuelve `undefined` y el evento se publica y marca `published` sin bucle.
  - Fixture: emite un evento, un miembro se suscribe, un no miembro no puede, y el push encola
    solo para los miembros.
- Fuera: la UI móvil del realtime (07); los eventos concretos de OweNo (06); credenciales reales.

**Dependencias**: tarea 02 `finalizada`. Puede ir en paralelo con la 03.

**Riesgos**: la autorización del canal es una superficie de fuga entre grupos; el envoltorio en
`public` debe ser mínimo y auditable; sin credenciales FCM el push no se puede probar de extremo
a extremo (se acepta el evento publicado y el envío deshabilitado).

**Criterios de aceptación**
- El fixture declara un canal, emite un evento y un miembro se suscribe; un usuario que no es
  miembro no puede (`core_can_subscribe` = false) y un módulo desactivado cierra el canal.
- La `members_fn` funciona sin que el SQL del módulo escriba en `public`; el mecanismo queda
  probado y documentado.
- Un evento con `notify: ["push"]` resuelve los tokens de los miembros y no del autor; sin
  credenciales, el evento se marca `published` y no se reintenta en bucle.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`, `docs/infrastructure.md` (FCM por
  instancia) y los envoltorios actualizados.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter db-tests test` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Configurar Firebase en el panel (Ajustes → Notificaciones) o aceptar el push deshabilitado.
  Las credenciales no pasan por el chat.
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (autorización de canales, filtrado
por grupo, manejo de la cuenta de servicio).
