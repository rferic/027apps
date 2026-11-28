---
id: sprint-19-task-12
titulo: Landing, auditoría y cierre
area: docs + web + app
estado: test
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Fichas públicas del módulo con estado real y captura de demo, auditoría OWASP por otro agente y cierre del sprint.

**Ficheros:** `docs/ai/landing.md` · `apps/admin/src/components/landing/{app,self-host}-landing.tsx` · `apps/admin/src/lib/landing/metadata.ts`

**Hecho cuando:** La landing no promete nada que no exista; sin hallazgos críticos/altos; checks de CI en verde.


**Hecho (2026-11-28):** NotNow está en `/` (fila «02 / NotNow», cuatro características, maqueta con
datos de demo y la marca `In development`) y en `/self-host` (tarjeta del panel, mismo estado), con
`docs/ai/landing.md` actualizado y las 31 cadenas nuevas traducidas a los 9 idiomas. Auditorías de
calidad, estilo y seguridad hechas; sus hallazgos altos y medios corregidos y re-verificados.

**Pendiente:** aceptación del propietario sobre el APK de staging; al aceptar, pasar NotNow a
`available` en las dos páginas y en la tabla de `docs/ai/landing.md` en el mismo PR.
