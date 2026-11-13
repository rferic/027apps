---
id: sprint-15-task-05
titulo: Datos de demo del Core y de los módulos
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-11-13-module-runtime.md
fuente: docs/tasks/sprint-15-app-y-finanzas/README.md (D21); docs/ai/module-system.md
adrs: [0007]
---

**Tarea**: permitir datos de demo en una instancia sin inventar un módulo: un ajuste del Core, un
dataset con ids estables y un contrato para que cada módulo siembre lo suyo y lo limpie. Es la
base de las capturas de la landing y de la aceptación del móvil.

**Alcance**
- Dentro:
  - Ajuste `demo.enabled` (bool, por defecto `false`); se rechaza en producción salvo override
    explícito. Sin él, la capacidad no existe para el usuario.
  - Dataset del Core con **ids estables** (`demo.ana@example.test`…), categorías e invitación;
    `POST /api/v1/demo` (admin) **idempotente** y `DELETE /api/v1/demo` (admin) que se niega
    mientras un módulo declare datos de demo enlazados.
  - **Ningún email real**: correos `@example.test`; las invitaciones de demo quedan marcadas como
    no enviadas y no llaman a Resend.
  - **Contrato del módulo**: `demo: { seed_fn, clear_fn }` en el manifest; funciones del esquema
    del módulo que reciben un `jsonb` con los ids del dataset y devuelven recuentos. El Core las
    ejecuta en una transacción al instalar/borrar demo y llama a `clear_fn` al desinstalar antes
    de borrar el esquema. Cambio `module-contract`: esquema, docs, ejemplos y envoltorios.
  - La **ficha del módulo** muestra «Instalar datos de demo» solo si `demo.enabled` y el dataset
    existe; si no, la tarjeta no aparece.
  - Fixture de demo para `db-tests`: siembra, segunda siembra sin duplicar, borrado bloqueado y
    borrado limpio.
- Fuera: el seed concreto de OweNo (06); las capturas (07); un módulo `demo` propio (descartado
  en D21).

**Dependencias**: tareas 02 y 03 `finalizadas` (instalador seguro y ficha del módulo).

**Riesgos**: sembrar en producción por error; correos reales a direcciones inventadas; dejar
datos huérfanos si se borra el usuario antes que el módulo; confundir datos de demo con reales en
las capturas.

**Criterios de aceptación**
- Con `demo.enabled` apagado, `POST /api/v1/demo` responde `403` y el botón no aparece; en una
  instancia marcada como producción también se rechaza.
- Instalar el demo dos veces no duplica; borrar demo se niega si un módulo tiene datos enlazados
  y, tras limpiarlos, elimina usuarios, categorías e invitaciones sin dejar huérfanos.
- No se envía ningún email; las invitaciones de demo quedan como no enviadas.
- El fixture declara `seed_fn`/`clear_fn`, el Core las ejecuta y los recuentos cuadran.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`, `docs/flows/new-module.md`,
  `docs/infrastructure.md` y los envoltorios actualizados.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter db-tests test` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Autorizar la siembra en staging (nunca en producción).
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (gate de producción, correos,
borrado ordenado, datos personales ficticios).
