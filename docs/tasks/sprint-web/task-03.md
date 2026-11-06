---
id: sprint-web-task-03
titulo: Dominio local de desarrollo (027apps.local) y public_url local
area: infra
estado: test
plan: docs/superpowers/plans/2026-11-06-local-dev-domain.md
spec: docs/superpowers/specs/2026-11-06-local-dev-domain-design.md
adrs: [0004]
---

**Alcance**:
- Habilitación de `027apps.local` mediante proxy Caddy en OrbStack y orígenes permitidos en `next.config.ts`.
- Ajuste de la política de `public_url` en `packages/core/src/settings/catalog.ts` para permitir `http` exclusivamente en hosts locales (incluyendo `localhost`, `*.local`, `*.test`, `127.0.0.1`, IPs privadas).
- Actualización de `supabase/config.toml` con `site_url = "http://027apps.local"` y URLs de redirección adicionales.
- Adaptación del paso de preferencias del asistente (`preferences-step.tsx`) con patrones de validación adaptados y localización en 9 idiomas.
- Documentación exhaustiva del flujo de desarrollo local (`docs/flows/local-development.md`).

**TDD**:
- Pruebas unitarias para orígenes de desarrollo permitidos (`dev-origins.test.ts`).
- Pruebas de validación de URLs públicas y restricciones http/https local (`packages/core/src/settings/catalog.test.ts`).

**DoD**:
- TDD, `lint`, `tsc`, tests, `i18n:check`, build del admin, verificación en navegador del dominio local, y auditorías QA/OWASP y estilo antes de `finalizada`.
