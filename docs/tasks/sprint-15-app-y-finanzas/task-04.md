---
id: sprint-15-task-04
titulo: Módulo — realtime, canales y push
area: core
estado: test
plan: docs/superpowers/plans/2026-11-13-module-runtime.md
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

## Bitácora de verificación end-to-end (2026-11-15)

Verificado en un emulador Android 14 **con Google Play Services** (el de `google_apis` no sirve:
no puede pedir token). Tres fallos reales encontrados y corregidos en esta sesión:

1. **La restricción de la API key de Firebase** no incluía la app de desarrollo. La clave estaba
   limitada a `com.rferic.zero27apps` con la huella del keystore canónico, así que toda petición
   desde el APK de pruebas devolvía `API_KEY_ANDROID_APP_BLOCKED` y el SDK solo mostraba
   `FCM Registration failed!`. Añadida la huella del keystore de depuración a la clave (y
   registrada también en la app de Firebase). No es un cambio de código, pero sin él la push no
   puede funcionar en ningún dispositivo de pruebas.
2. **El hook `afterWrite` publicaba la outbox sin el puerto de push**: realtime llegaba y la
   notificación no existía. Ahora `outboxDepsFromSettings` monta realtime **y** push desde un
   único sitio, compartido con el job de mantenimiento (`apps/admin/src/lib/realtime.ts`).
3. **La `members_fn` de un canal nunca estaba en `public`**: el SQL de un módulo solo puede crear
   en su esquema (`module_<key>`), y el relay la buscaba en `public`, así que el `catch` la
   degradaba a cero destinatarios y toda push de canal se descartaba en silencio. Ahora se
   resuelve el esquema real por `pg_proc` (con `public` como compatibilidad).

Además, el autor del cambio ya no recibe su propia push (`actor_id` en el recurso).

Probado con dos cuentas: Ana registra un gasto y el dispositivo de otro miembro recibe
«OweNo · Compra del súper · Demo family · Ana Demo», sin importe con el ojo cerrado y con
importe con el ojo abierto; al tocar la notificación la app abre el grupo. El autor no recibe
nada de sus propios movimientos.

Pendiente para el release firmado: la huella del keystore de release debe estar en la misma
clave de API; la que hay hoy (`05:C0:03:…:30:06`) no coincide con la documentada como canónica
en `sprint-04-infra/task-08.md` (`F0:A5:D0:…:9B:61`) y hay que confirmarlo antes de publicar.
