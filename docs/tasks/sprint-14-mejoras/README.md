---
id: sprint-14-mejoras
titulo: Invitaciones por email, rendimiento, landing y deuda de infraestructura
area: producto
estado: pendiente
---

Sprint **pendiente de definir**. El propietario explicará el alcance exacto de cada punto al
arrancarlo; aquí solo queda registrado que existen y que **no** se han implementado.

## Candidatas de producto

| # | Tema | Estado | Notas |
|---|---|---|---|
| 1 | **Envío de invitaciones por email** | Pendiente de spec | Hoy la invitación **no envía correo**: al crearla se muestra un enlace que el admin comparte a mano. Debe enviarse con Resend (dominio `mail.ericrf.com`), con el enlace `/invite/<token>`, caducidad y remitente de la instancia. **Requiere mockup del correo que recibe la persona invitada** antes de implementar. El enlace manual queda como respaldo. Ver `sprint-13-staging-prod/task-06.md` (cierre). |
| 2 | **Rendimiento de las llamadas a la API** | Pendiente de análisis | El propietario percibe lentitud. Antes de tocar código: medir con datos reales (Vercel Analytics/logs, tiempos por ruta) y localizar si es cold start, consultas, N+1, regiones o tamaño de bundle. La spec debe fijar objetivos medibles. |
| 3 | **Landing page** | Pendiente de spec | Página pública de presentación del producto (hoy `/` redirige a `/login`). Alcance, contenidos e idioma pendientes de definir con el propietario. |

## Deuda de infraestructura

| # | Tema | Estado | Notas |
|---|---|---|---|
| 4 | **FCM / notificaciones push** | Pendiente (necesita credenciales) | Crear proyecto Firebase, registrar la app Android `com.rferic.zero27apps`, añadir `google-services.json` y el plugin de Gradle al APK, y configurar FCM en el panel (hoy “None for now”). El panel ya soporta FCM; sin `google-services.json` la app no registra tokens. |
| 5 | **Copia secundaria de backups (3-2-1)** | Pendiente (necesita credenciales) | Añadir un segundo bucket en otro proveedor y un paso `restic copy` al workflow de backup. Hoy solo existe el repositorio principal en Backblaze B2. Documentado en `docs/infrastructure.md` §8. |
| 6 | **Backup de ficheros de Storage** | Pendiente de uso real | Hoy no hay buckets de Storage en uso (la app no sube ficheros), así que no hay nada que respaldar. Diseñar el `rclone`/`aws s3 sync` contra la API S3 de Supabase cuando el producto empiece a usar Storage. §8. |
| 7 | **Dependabot pendiente** | Pendiente de merge | PRs #33 (eslint 10), #34 (@types/node 26), #38 (gradle) y #39 (actions), reorientados a `staging`. #38 y #39 están limpios; #33 y #34 quedaron conflictivos y esperan rebase. Los saltos mayores (eslint 10, TypeScript 7, @types/node 26) requieren comprobar CI y el build antes de mergear. |

## Reglas

- Cada punto necesita spec aprobada antes de implementar (`AGENTS.md`); los de infraestructura
  que solo son configuración o credenciales pueden ir como tareas `chore`/`infra` con su
  evidencia.
- Nada de este sprint se ha empezado; no hay rama `sprint/14-*` todavía.
