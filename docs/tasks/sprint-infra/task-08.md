---
id: sprint-infra-task-08
titulo: Proyecto Firebase + FCM (notificaciones push)
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/superpowers/specs/2026-10-26-realtime-notificaciones.md §6
---

**Tarea**: crear el proyecto Firebase de la instancia y configurar **FCM (push)** para que las notificaciones lleguen con la app cerrada.

**Pasos (puerta de setup del usuario — solo los puede hacer él)**:
1. Crear un **proyecto Firebase gratuito** (cuenta Google).
2. Registrar la app Android con el **package name del APK** de 027Apps.
3. Copiar los valores **públicos** al panel/wizard (`settings`, categoría `notifications.push`, task-06): `fcm_project_id`, `fcm_app_id`, `fcm_api_key`, `fcm_sender_id`.
4. Generar una **cuenta de servicio** (service account JSON) y subirla para que el servidor pueda enviar por **FCM HTTP v1**; se guarda **cifrada** en `settings` (`value_encrypted`, clave maestra en env).
5. Verificar de extremo a extremo: un evento con `notify: ["push"]` llega al dispositivo con la app cerrada.

**Notas**:
- Es **opcional** para cualquier instancia (degradación elegante: sin FCM, realtime + bandeja de novedades), pero **obligatoria para la instancia del autor** (decisión del usuario, 2026-10-26).
- El APK es **único** para todas las instancias: la configuración se hace **en runtime** desde settings (valores públicos) — nunca se hornea `google-services.json` en el build.
- El service account JSON **nunca** va a git ni a logs (`guard-secrets` del CI).
- Depende de: Core implementado con `POST /devices` y el envío FCM (task-04 del sprint de diseño del Core).

**Criterios de aceptación**: proyecto Firebase creado; valores públicos en settings; service account cifrado; push verificado con la app cerrada; sin secrets en el repo.
