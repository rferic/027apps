---
id: sprint-infra-task-13
titulo: Guía de autoalojamiento + skill de IA
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: petición del usuario (2026-11-01)
---

**Tarea**: dejar documentado, para cualquier persona que quiera montar su propia instancia, el
paso a paso completo de la infraestructura — y una **skill** que permita a su IA guiarle por ese
paso a paso.

**Entregables**:

1. `docs/self-hosting.md` — guía completa en inglés (superficie pública): requisitos, Supabase
   (local y cloud), variables de entorno, Vercel, email transaccional, protecciones de GitHub,
   keystore de Android, Firebase/FCM opcional, backups, activación de producción y checklist de
   verificación. Enlaza a los documentos internos (en español) para el detalle.
2. `README.md` — sección *Self-hosting* que enlaza la guía y la skill.
3. Skill `self-hosting` en `.opencode/skills/self-hosting/SKILL.md`, con espejos en
   `.agents/skills/self-hosting/SKILL.md` y `.claude/skills/self-hosting/SKILL.md` (punteros,
   como la skill `new-module`). La skill debe: leer la guía como fuente canónica, preguntar en
   qué fase está el usuario, guiar paso a paso con verificación real y **no pedir secretos por
   chat**.

**Criterios de aceptación**:

- Una persona nueva puede montar dev + preview siguiendo la guía sin leer los ficheros de tarea.
- Cada paso declara su verificación (comando o comprobación en panel) y qué hacer si falla.
- La skill arranca desde el repo, no duplica la guía y tiene guardarraíles de secretos.
- `README.md` enlaza guía y skill; los enlaces se comprueban.
- `docs/infrastructure.md` §9 sigue siendo la fuente de la activación de producción; la guía
  enlaza a ella en vez de duplicar la checklist.

**Notas**:

- La guía se escribe en inglés porque es documentación pública (misma regla que el README); los
  specs internos siguen en español.
- No incluye valores de secretos ni claves: solo nombres de variables y comandos que las piden
  por stdin.
- Se apoya en lo ya verificado en las tareas 01–12; no repite el detalle de los ficheros de
  tarea, los referencia.

## Bitácora

- **2026-11-01 · finalizada.** Entregables creados y verificados: `docs/self-hosting.md` (guía en inglés, fases 0–9 + checklist de verificación), skill `self-hosting` en `.opencode/skills/self-hosting/SKILL.md` con espejos en `.agents/skills/` y `.claude/skills/`, y enlaces en `README.md` §Self-hosting (guía + runbook + skill). La guía enlaza a `docs/infrastructure.md` §9 para la activación de producción en vez de duplicar la checklist. Verificación de enlaces hecha contra el árbol de `docs/`.
