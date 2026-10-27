---
id: sprint-infra-task-11
titulo: Ampliar guard-secrets a los prefijos del proyecto
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
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

## Evidencia (2026-10-27)

- **Patrones añadidos** (`.github/workflows/ci.yml`, job `guard-secrets`): `027_(svc|usr)_[A-Za-z0-9_-]{20,}`, `SETTINGS_ENCRYPTION_KEY[[:space:]]*[=:][[:space:]]*["']?[A-Za-z0-9+/=]{20,}` y `google-services.json` rastreado (config de app que nunca se hornea en el build).
- **Rojo real**: run [40521621072](https://github.com/rferic/027apps/actions/runs/40521621072) — el job falla y lista `google-services.json` y `fixture-guard-secrets.txt` (claves ficticias con prefijos reales). Solo nombres de fichero, nunca el contenido.
- **Verde real**: run [40521819933](https://github.com/rferic/027apps/actions/runs/40521819933) — retirado el fixture, el job pasa.
- **No auto-coincidencia**: los patrones no coinciden con su propio texto en `ci.yml` (clases de corchetes), comprobado con `grep` local antes de commitear.
- **Docs**: fila de `guard-secrets` en `docs/flows/cicd.md` ampliada; checklist `A06` marcada `[x]`.
- **Auditoría de seguridad (DoD Infra)**: sin cambios de `permissions` ni de acciones de terceros; los patrones solo imprimen nombres de fichero; no requiere secretos para ejecutarse (funciona en forks).
