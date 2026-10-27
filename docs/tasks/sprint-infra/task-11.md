---
id: sprint-infra-task-11
titulo: Ampliar guard-secrets a los prefijos del proyecto
area: infra
estado: pendiente
fuente: docs/conventions/security-checklist.md (A06) y docs/superpowers/specs/2026-10-26-seguridad.md §4.2
---

**Tarea**: que el CI **detecte** un secreto del proyecto pegado en el repo o en un doc.

**Estado actual**: el job `guard-secrets` de `.github/workflows/ci.yml` cubre `sbp_`, `sb_secret_`, JWT, `SERVICE_ROLE_KEY=`, claves PEM privadas y ficheros `.env*`/keystores. **No** cubre:
- claves de máquina del proyecto (`027_svc_…`, `027_usr_…`);
- `SETTINGS_ENCRYPTION_KEY=<valor>` hardcodeada.

**Pasos**:
1. Añadir los patrones al `git grep` del job (con la misma lógica de "falla si aparece").
2. Probar con un caso real (una clave ficticia con el prefijo correcto en un fichero temporal) → el job **debe** fallar; retirarlo → debe pasar.
3. Actualizar `docs/flows/cicd.md` (tabla de `guard-secrets`) y la checklist A06.

**Criterios de aceptación**: el job falla con un `027_svc_`/`027_usr_`/`SETTINGS_ENCRYPTION_KEY=` hardcodeado y pasa sin ellos; `cicd.md` actualizado con evidencia del run.
