---
id: sprint-15-task-07
titulo: OweNo en Android: pantallas, importador y capturas
area: app
estado: en curso
fuente: docs/superpowers/specs/2026-11-12-android-access-shell.md; spec de OweNo (pendiente); docs/tasks/sprint-15-app-y-finanzas/splitwise-export.md
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: llevar OweNo a la app Android **respetando el mockup F1 aprobado**, incluido el
**importador de Splitwise en la app** para el creador del grupo, y sustituir las maquetas de la
landing por capturas reales con datos de demo. Es **obligatoria en el sprint 15** porque el
propietario metió el importador en v1 (D3.2, C) y es una función móvil, no del panel.

**Alcance**
- Dentro: **inicio del módulo** (cabecera fija con logo y nombre, tarjeta de resumen y lista de
  grupos) y menú ⋯ con Grupos, Invitaciones, Importar y Ajustes del módulo; detalle con balances,
  alta de gasto con **reparto igual o importes exactos**, liquidación, **invitaciones pendientes (aceptar/rechazar)**, **gestión de miembros
  para el creador (invitar, echar, bloquear)** y **salir del grupo**,
  historial y estados de error/carga; **importador de Splitwise**: elegir el CSV **por grupo**,
  preview/dry-run, **rechazar multi-divisa con aviso**, mapear identidades no enlazadas a
  **cualquier usuario activo de la instancia** (selector por id + nombre) o crear ficticios,
  fusionar identidades del mismo usuario y confirmar; solo el creador del grupo. Sin Pro: solo
  CSV; autoenlace por nombre exacto y único; el CSV no trae emails, así que no hay autoenlace
  por email; **realtime (D12)**: suscripción al topic del grupo por Supabase Broadcast privado
  con el token de la sesión (reconexión con backoff y resincronización al volver del segundo
  plano); **push**: permiso `POST_NOTIFICATIONS`, alta del token FCM al entrar y baja al cerrar
  sesión con el token cifrado en Keystore (sustituye la pantalla manual y el token en
  `SharedPreferences`), y **aviso localizado** con las claves `push.<tipo>` en los 9 idiomas en
  vez de pintar la clave y el JSON crudo; reutiliza el cliente, la sesión y los tokens de la
  tarea 01; capturas reales de la app con datos de demo; landing `/` y `/self-host` con OweNo
  `available`; release del APK con tag (puerta del propietario).
- Widget de pantalla de inicio de Android: `AppWidget` con el saldo propio y los grupos, pintado
  desde una instantánea local que refresca un `WorkManager` cada 30 minutos; el toque abre la app.
- Fuera: offline, presupuestos, multi-divisa, edición avanzada de repartos y push en iOS.

**Dependencias**: tareas 01 y 06 `finalizadas`; datos de demo; dispositivo Android;
**Firebase configurado en la instancia** por el propietario (panel → Notificaciones, guía
`/help/firebase`). Sin esas credenciales la app compila y funciona, el realtime sigue, y la
tarea se acepta sin push: no se inventan tokens ni se pide la cuenta de servicio por chat.

**Riesgos**: la app puede duplicar reglas de negocio que ya viven en el dominio; la aceptación
móvil llega tarde; el release firmado exige subir `versionCode` y una orden explícita de tag.

**Criterios de aceptación**
- La app lista los grupos del usuario, muestra balances correctos y permite crear un gasto y
  liquidar contra staging; la UI corresponde con el mockup F1 aprobado.
- Las capturas reales de la landing usan datos de demo y coinciden con las pantallas aceptadas
  (no con las maquetas antiguas).
- Los importes se formatean con la moneda y el locale del perfil; las fechas son de calendario.
- Sin conexión muestra error y reintento, no un estado vacío falso.
- Landings actualizadas con capturas reales de demo (sin datos de la familia), 9 idiomas.
- APK de release firmado y publicado solo con orden explícita; `versionCode` incrementado.
- CI (`android`, `admin`, `guard-secrets`, `commitlint`, `ai-docs`) en verde.

**Puertas de usuario**
- Aceptar la UI en la app (dispositivo o emulador).
- Aprobar las capturas y la landing.
- Orden explícita de release/tag y de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (autorización de las pantallas,
manejo de importes, logs y release).

## Auditorías (2026-11-15)

- **Diseño/UX** (agente independiente): jerarquía, contraste de la pestaña activa, tamaños
  táctiles ≥ 44 dp, placeholders AA, foco en el primer campo vacío, un solo H1, error dentro
  de la hoja y feedback de guardado. Aplicado; quedan como deuda el footer único de las hojas
  y las capturas en 9 idiomas a fontScale 2.0.
- **Seguridad** (agente independiente): cerrados la inyección de miembros de otro grupo en
  movimientos e importación, la validación de categoría, el censo visible a exmiembros, el IDOR
  del historial de importación, el lock de importación concurrente, el JWT en claro del
  registro FCM, `allowBackup`, el payload crudo en las notificaciones, el snapshot del widget
  sin cifrar y el log de errores con cuerpo. Pendientes menores: límite de cuerpo del import
  (400 KB), hash del APK en la actualización.
