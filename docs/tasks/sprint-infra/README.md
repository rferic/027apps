---
id: sprint-infra
titulo: Infraestructura y setup del usuario
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
---

Sprint de **infraestructura**: todo lo que no puede hacer un agente porque exige una cuenta o un panel externo (GitHub, Supabase, Vercel, Firebase, proveedor SMTP). Son **puertas de setup del usuario** guiadas y verificadas por el agente.

**Por qué va antes que el código**: sin proyecto Supabase + envs no hay BD que migrar, ni tests de integración, ni previews. Es el **bloqueante número uno** de la implementación del Core.

## Cierre (2026-10-31)

Sprint **cerrado**: las 13 tareas están `finalizada` dentro de su alcance de infra. Tres tareas
cuyo único pendiente requiere el Core o el proyecto de producción quedan cerradas aquí y su
verificación trasladada:

- **task-08** (Firebase/FCM) → la verificación end-to-end (subida del service account a
  `settings`, `POST /devices`, push con app cerrada) es criterio del **task-06 de
  `sprint-06-core-data`** (realtime, outbox, push y jobs).
- **task-07** (keep-alive) y **task-12** (backups, verificación real) → trasladadas a
  **`sprint-prod-activation`**, sprint que se ejecuta cuando se crea `027apps-prod` (al cierre
  de sprint-05, decisión del usuario de 2026-10-27).

## Tareas (orden de ejecución)

| Orden | Tarea | Qué desbloquea |
|---|---|---|
| 1 | **04** Proyecto Supabase + envs (dev/preview/prod) | Migraciones, tests, todo |
| 2 | **09** `SETTINGS_ENCRYPTION_KEY` | Secretos cifrados (settings, FCM) |
| 3 | **05** SMTP del proyecto (Resend/Brevo) | Reset de contraseña, alta por invitación |
| 4 | **06** Vercel conectado (previews) | Aceptación de resultados en preview |
| 5 | **01** Proteger `main` (ruleset) | Integración segura |
| 6 | **02** Ruleset de tags `v*` | Releases |
| 7 | **08** Firebase + FCM | Push (verificación e2e en sprint-06, task-06) |
| 8 | **10** CODEOWNERS + propiedad de workflows | Anti-exfiltración de secretos de CI |
| 9 | **11** Ampliar `guard-secrets` (prefijos `027_*`) | Detección de claves del proyecto |
| 10 | **03** Environment release + keystore + secrets APK | Publicar APK |
| 11 | ~~**07** `PROD_URL` para keep-alive~~ | Trasladada a `sprint-prod-activation` (task-01) |
| 12 | ~~**12** Backup cifrado (verificar)~~ | Trasladada a `sprint-prod-activation` (task-02) |
| 13 | **13** Guía de autoalojamiento + skill de IA | Que un tercero monte su instancia |

**Puerta de entrada:** ninguna (se puede empezar ya). **Depende de:** nada.
