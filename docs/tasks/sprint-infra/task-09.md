---
id: sprint-infra-task-09
titulo: SETTINGS_ENCRYPTION_KEY (clave maestra de secretos)
area: infra
estado: test
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/superpowers/specs/2026-10-26-instance-config.md §5
---

**Tarea (puerta de setup del usuario)**: generar y provisionar la **clave maestra** que cifra los secretos de la instancia (`settings.value_encrypted`).

**Pasos**:
1. Generar **32 bytes aleatorios** (CSPRNG) y codificarlos en base64 → `SETTINGS_ENCRYPTION_KEY`.
2. Cargarla como **variable de entorno** del hosting (Preview y Production), nunca en git ni en la BD.
3. Guardar una copia en el **gestor de secretos** del propietario, **separada del backup de la BD** (backup + clave = texto claro; pérdida de la clave = secretos irrecuperables).
4. Verificar que la app arranca sin `degraded` y que un secreto (p. ej. el service account de FCM) se guarda y se usa.

**Notas**:
- Sin esta clave, los pasos del wizard que guardan secretos fallan de forma controlada (`degraded`), no a medias.
- La **rotación** (doble clave + re-cifrado con nonce nuevo) se documenta en el runbook de infraestructura.
- Añadir a `guard-secrets` una regla que detecte `SETTINGS_ENCRYPTION_KEY=<valor>` hardcodeada (nota para la implementación del CI).

**Depende de**: Core implementado (`settings` + cifrado, task-06 del sprint de diseño).

## Bitácora (2026-10-27)

- **Generada** por el agente con `openssl rand -base64 32` y escrita **directamente** en `apps/admin/.env.local` sin imprimir el valor (ni en chat ni en logs). 32 bytes → base64.
- **`guard-secrets`** ya la detecta si se hardcodea (`SETTINGS_ENCRYPTION_KEY=<valor>`, tarea 11, run rojo [40521621072](https://github.com/rferic/027apps/actions/runs/40521621072)).
- **Copia en el gestor de contraseñas**: hecha por el usuario el 2026-10-27 (confirmada en sesión; el valor no pasó por el chat: `pbcopy` desde `.env.local`). Entrada propia, separada del backup de la BD.
- **Pendiente**: añadirla a Vercel (Preview + Production) en infra-06.
- **Pendiente (sprint-05 task-04)**: verificación de uso real — guardar un secreto en `settings` (cifrado AES-256-GCM) y leerlo.
- **Riesgo mientras no esté en el gestor**: si se pierde `.env.local` la clave se pierde; hoy **no hay ningún secreto cifrado con ella**, así que el impacto es nulo. Cuando se guarden secretos, la clave es irrecuperable sin copia.
