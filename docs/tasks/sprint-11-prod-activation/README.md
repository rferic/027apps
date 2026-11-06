---
id: sprint-11-prod-activation
titulo: Activación de producción — keep-alive y backups reales
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-sprint-04-infra.md
---

Sprint que se ejecuta **cuando se crea el proyecto Supabase `027apps-prod`** (decisión del
usuario de 2026-10-27: se crea al cierre de sprint-08-core-base, no antes). Contiene las puertas de setup
del usuario trasladadas desde `sprint-04-infra`: sin prod no hay URL que vigilar ni BD que respaldar.

**Por qué se separa**: mientras no exista `027apps-prod`, es imposible apuntar por error a
producción; estas tareas no pueden ejecutar su verificación (ni marcar `finalizada` con
evidencia real) hasta ese momento.

## Tareas (orden de ejecución)

| Orden | Tarea | Qué desbloquea |
|---|---|---|
| 1 | **01** `PROD_URL` para keep-alive | Salud en producción |
| 2 | **02** Backup cifrado (verificar) | Primera copia restaurable fuera de Supabase |

**Depende de:** sprint-08-core-base cerrado (Core funcional) y proyecto `027apps-prod` creado.
