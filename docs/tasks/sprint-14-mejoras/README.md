---
id: sprint-14-mejoras
titulo: Envío de invitaciones, rendimiento y landing page
area: producto
estado: pendiente
---

Sprint de **mejoras de producto** pendiente de definir. El propietario explicará el alcance
exacto de cada punto al arrancarlo; aquí solo queda registrado que existen y que **no** se han
implementado.

## Candidatas

| # | Tema | Estado | Notas |
|---|---|---|---|
| 1 | **Envío de invitaciones por email** | Pendiente de spec | Hoy la invitación **no envía correo**: al crearla se muestra un enlace que el admin comparte a mano. Debe enviarse con Resend (dominio `mail.ericrf.com`), con el enlace `/invite/<token>`, caducidad y remitente de la instancia. **Requiere mockup del correo que recibe la persona invitada** antes de implementar. El enlace manual queda como respaldo. Ver `sprint-13-staging-prod/task-06.md` (cierre) y `docs/flows/local-development.md` (SMTP). |
| 2 | **Rendimiento de las llamadas a la API** | Pendiente de análisis | El propietario percibe lentitud. Antes de tocar código: medir con datos reales (Vercel Analytics/logs, tiempos por ruta) y localizar si es cold start, consultas, N+1, regiones o tamaño de bundle. La spec debe fijar objetivos medibles. |
| 3 | **Landing page** | Pendiente de spec | Página pública de presentación del producto (hoy `/` redirige a `/login`). Alcance, contenidos e idioma pendientes de definir con el propietario. |

## Reglas

- Cada punto necesita spec aprobada antes de implementar (`AGENTS.md`).
- Nada de este sprint se ha empezado; no hay rama `sprint/14-*` todavía.
