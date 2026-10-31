---
id: sprint-infra
titulo: Infraestructura y setup del usuario
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
---

Sprint de **infraestructura**: todo lo que no puede hacer un agente porque exige una cuenta o un panel externo (GitHub, Supabase, Vercel, Firebase, proveedor SMTP). Son **puertas de setup del usuario** guiadas y verificadas por el agente.

**Por qué va antes que el código**: sin proyecto Supabase + envs no hay BD que migrar, ni tests de integración, ni previews. Es el **bloqueante número uno** de la implementación del Core.

## Tareas (orden de ejecución)

| Orden | Tarea | Qué desbloquea |
|---|---|---|
| 1 | **04** Proyecto Supabase + envs (dev/preview/prod) | Migraciones, tests, todo |
| 2 | **09** `SETTINGS_ENCRYPTION_KEY` | Secretos cifrados (settings, FCM) |
| 3 | **05** SMTP del proyecto (Resend/Brevo) | Reset de contraseña, alta por invitación |
| 4 | **06** Vercel conectado (previews) | Aceptación de resultados en preview |
| 5 | **01** Proteger `main` (ruleset) | Integración segura |
| 6 | **02** Ruleset de tags `v*` | Releases |
| 7 | **08** Firebase + FCM | Push |
| 8 | **10** CODEOWNERS + propiedad de workflows | Anti-exfiltración de secretos de CI |
| 9 | **11** Ampliar `guard-secrets` (prefijos `027_*`) | Detección de claves del proyecto |
| 10 | **03** Environment release + keystore + secrets APK | Publicar APK |
| 11 | **07** `PROD_URL` para keep-alive | Salud en producción |
| 12 | **12** Backup cifrado (verificar) | Recuperación (implementado, `test`) |

**Puerta de entrada:** ninguna (se puede empezar ya). **Depende de:** nada.
