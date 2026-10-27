---
id: sprint-05-task-04
titulo: Salud, instancia y ajustes con secretos cifrados
area: core
estado: pendiente
adrs: [0004, 0007, 0008]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `GET /health` (ok/degraded, 503, caché 30 s), `GET /instance` con `version`, `requires_setup`, `setup_incomplete` y `settings_public`; `GET /settings` (secretos **enmascarados** con `configured`), `PATCH /settings/{category}.{key}` (solo valor, validación por catálogo, `security.*`/`public_url`/CORS solo super_admin); cifrado **AES-256-GCM** (nonce nuevo por cifrado, AAD = versión+clave, formato versionado); `currencies` + default habilitada.

**TDD**: secreto nunca sale en claro; editar una clave manual cambia el cuerpo servido; moneda deshabilitada → `currency_not_enabled`; descifrado fallido → degradado controlado.

**DoD**: TDD, checks, ADRs 0004/0007/0008, QA + auditoría; checklist A02/A05.
