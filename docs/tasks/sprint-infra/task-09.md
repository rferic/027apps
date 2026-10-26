---
id: sprint-infra-task-09
titulo: SETTINGS_ENCRYPTION_KEY (clave maestra de secretos)
area: infra
estado: pendiente
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
