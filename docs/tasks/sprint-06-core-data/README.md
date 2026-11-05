---
id: sprint-06-core-data
titulo: Core datos y plataforma — personas, claves, módulos, realtime y jobs
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

Sprint de **implementación** de la superficie transversal completa: personas, invitaciones, claves, módulos, realtime y mantenimiento.

**Depende de:** sprint-05 (base, auth, API, settings). **Specs:** task-02/03/04/06/07 del diseño del Core.

| # | Tarea | Entregable |
|---|---|---|
| 01 | Usuarios y roles | list/get/update/assign-role/deactivate + invariantes root y ≥1 super_admin |
| 02 | Categorías de usuarios | CRUD + miembros + asignar módulo (materializa `user_modules`) |
| 03 | Invitaciones | crear/listar/revocar + `/redeem` público (email+contraseña, single-use) |
| 04 | API keys y dispositivos | emisión single-show, scopes, `role_cap`, revocación; `POST /devices` |
| 05 | Módulos | registry, manifest, instalador (digest + rol), lifecycle, `admin_pages`, docs check, settings de módulo |
| 06 | Realtime, outbox, push y jobs | canales + `core_can_subscribe`, `publish()` + outbox, FCM, `maintenance/*` con lease |

**Nota de alcance (2026-10-31)**: el task-06 hereda la **verificación end-to-end de FCM**
trasladada desde `sprint-infra` task-08 (cerrado por traslado): subir el service account
cifrado a `settings`, registrar un dispositivo vía `POST /devices` y comprobar que el push
llega con la app cerrada. Es criterio de aceptación de esta tarea junto con la implementación.

**Cierre:** DoD de Código completo + auditoría OWASP por tarea.

## Puerta de aceptación de despliegue (2026-11-05)

La implementación de FCM está terminada y auditada, pero **la verificación end-to-end no se ha ejecutado** por falta de credenciales reales. Antes de activar push en producción:

1. Subir la service account real a `notifications.push.fcm_service_account`.
2. Configurar `notifications.push.provider = fcm` y las claves públicas FCM.
3. Usar la pantalla de aceptación FCM de Android (`MainActivity`) para inicializar Firebase con `/instance`, registrar el token y recibir mensajes data-only. La integración ya está implementada en `FcmRegistrar` y `PushMessagingService`; las pruebas unitarias y `assembleDebug` pasan en local.
4. Registrar un dispositivo real con `POST /api/v1/devices`.
5. Comprobar un push con la app cerrada y revocar un token `UNREGISTERED`.

Esta puerta se documenta como aceptación de despliegue, no como tarea de implementación abierta.
