---
id: sprint-19-task-10
titulo: App Android
area: app
estado: test
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Pantallas del módulo, bandeja de solicitudes, power y resultados, y el receptor de acciones del push.

**Ficheros:** `data/Dtos.kt`, `data/ApiClient.kt`, `ui/screens/Todo*.kt`, `ui/components/EmojiPicker.kt`, `ui/AppRoot.kt`

**Hecho cuando:** El propietario completa en el móvil los flujos del mockup, incluida la aceptación desde la notificación.


**Cómo verificar en local.** El APK de debug apunta a `http://10.0.2.2:3003`, pero
`/api/v1/instance` publica `supabase_url: http://127.0.0.1:54321`: sin
`adb -s <device> reverse tcp:54321 tcp:54321` el login falla con «Can't sign in right now». Con
el reverse hecho, el login por `adb shell input text` funciona (el problema nunca fue el teclado).

**Recorrido hecho (2026-11-28), dos usuarios:** grupos y Personal · grupo con pendientes/hechas ·
coger, completar, soltar, pedir · alta con emoji, power y dueño · detalle con edición, historial y
deshacer · bandeja «me las piden»/«he pedido» con aceptar · power, cierre de temporada, archivo y
resultados · alta de grupo con power y periodo · ajustes (miembros, añadir/echar, borrar) y solo
lectura para quien no es dueño.

**Pendiente de verificación real:** los botones Aceptar/Denegar de la notificación (receptor
`TodoRequestActionReceiver` implementado y probado en unitarios; sin FCM en local no hay push que
pulsar). Se prueba en staging con el APK y dos móviles.
