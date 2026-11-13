---
id: sprint-15-task-09
titulo: Módulo — tareas programadas
area: core
estado: pendiente
fuente: docs/ai/module-system.md; vercel.json; docs/infrastructure.md
adrs: [0007]
---

**Tarea**: que un módulo pueda declarar trabajo periódico (limpiezas, recordatorios, recurrencias
futuras) sin que el Core conozca su lógica. Hoy no existe: el módulo tendría que pedir un cron
propio, que no es autoalojable.

**Alcance**
- Dentro:
  - **Contrato**: `jobs: [{ key, name, schedule, fn, timeout_seconds? }]`; `schedule` en cron de
    5 campos; `fn` es una función del esquema del módulo que se ejecuta sin usuario
    (`security definer` prohibido: recibe un contexto explícito). Cambio `module-contract`:
    esquema, docs, ejemplos y envoltorios.
  - **Registro**: `module_job_runs` (o equivalente) con `module_key`, `job_key`, `started_at`,
    `finished_at`, `status`, `error`, `duration_ms`; últimos N por trabajo. Nunca guarda datos
    del payload.
  - **Dispatcher**: `POST /api/v1/maintenance/module-jobs` autenticado por el secreto de
    mantenimiento (no por sesión), que calcula qué trabajos vencen en ese minuto, los ejecuta con
    timeout, registra el resultado y no solapa ejecuciones. Idempotente por minuto.
  - **Vercel Cron**: una entrada en `vercel.json` que llama al dispatcher cada minuto; en local,
    el mismo endpoint se puede invocar a mano y hay un botón **Ejecutar ahora** por trabajo en el
    panel.
  - Los trabajos de un módulo inactivo **no** se ejecutan; uno desinstalado no deja filas.
- Fuera: colas con reintentos por trabajo; editor visual de cron; jobs de usuario.

**Dependencias**: tareas 02 y 08 `finalizadas` (registro y contrato versionado).

**Riesgos**: un job que tarda más que el minuto y se solapa; uno que falla siempre y llena la
tabla; un cron mal escrito; ejecutar trabajos de un módulo desactivado.

**Criterios de aceptación**
- El fixture declara un job por minuto; el dispatcher lo ejecuta una vez por minuto y deja una
  fila con `status: ok` y su duración.
- Dos llamadas en el mismo minuto no lo ejecutan dos veces.
- Un job que lanza un error deja `status: error` con el mensaje y el dashboard del panel lo
  muestra; el siguiente minuto vuelve a intentarlo.
- Un módulo `disabled` no ejecuta sus jobs.
- El secreto de mantenimiento no aparece en logs ni en la respuesta.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`, `docs/infrastructure.md` y
  `docs/flows/cicd.md` actualizados; `vercel.json` con el cron.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter db-tests test` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Autorizar el cron en el preview/staging (una llamada por minuto).
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (secreto de mantenimiento, timeout,
ejecución de funciones de módulo y límites).
