# Instalar módulos desde el panel — plan de implementación

**Tarea:** `docs/tasks/sprint-06-web/task-15.md` · **Spec:** `docs/superpowers/specs/2026-11-08-module-install-design.md`

Orden TDD: rojo → verde → refactor en cada paso. Comandos desde la raíz del repo.

## Paso 1 — Descubrimiento de paquetes (`listModulePackages`)

- Test: `apps/admin/src/lib/module-packages.test.ts` con un `MODULES_ROOT` temporal (directorio vacío,
  manifest inválido, directorio cuya clave no coincide, paquete ya instalado excluido). Ejecutar
  `pnpm --filter admin test module-packages` → rojo.
- Implementar: `apps/admin/src/lib/module-packages.ts`. Lee `process.env.MODULES_ROOT` (mismo fallback
  que `lib/modules.ts`), `readdir` con `withFileTypes`, parsea `manifest.json` con el schema del Core
  (`@027apps/core/modules/manifest.js`), devuelve `{ key, name, version, description, valid, reason? }`
  sin rutas absolutas. Errores de disco se capturan por paquete.
- Verificar: el mismo comando → verde.

## Paso 2 — Server action de instalación

- Test: `apps/admin/src/lib/module-install.test.ts` con `fetch` simulado: éxito (200), 409, 400, 403 y
  `request_id` en el error. Patrón de `lib/panel-keys.test.ts`.
- Implementar: `apps/admin/src/lib/module-install.ts` (llamada en proceso a
  `POST /api/v1/modules/{key}/install` con el Bearer de sesión, zod en el borde con la clave) y la
  acción en `apps/admin/src/app/(panel)/modules/install/actions.ts`.
- Verificar: `pnpm --filter admin test module-install` → verde.

## Paso 3 — Página `/modules/install`

- Test: `apps/admin/src/app/(panel)/modules/install/page.test.tsx`: lista de no instalados, botón
  Install por paquete, inválidos deshabilitados con motivo, estado vacío, 403 vía `requirePanel`.
- Implementar: `page.tsx` (`requirePanel("admin")`, `export const instant = false`) y `loading.tsx`.
- Verificar: `pnpm --filter admin test modules/install` → verde.

## Paso 4 — Acción primaria en `/modules`

- Test: en `apps/admin/src/app/(panel)/modules/page.test.tsx`, la acción **Install module** existe y
  enlaza a `/modules/install`.
- Implementar: la acción en la cabecera de `/modules/page.tsx`.
- Verificar: `pnpm --filter admin test modules/page` → verde.

## Paso 5 — i18n (9 idiomas)

- Añadir las cadenas nuevas (título, descripción, botón, motivos, estado vacío, errores 409/400/403) en
  los 9 locales.
- Verificar: `pnpm i18n:check` → verde.

## Paso 6 — Gates y cierre

- `pnpm lint && pnpm tsc && pnpm test`
- `pnpm --filter admin build` (dev server parado; leer la salida).
- Revisión de segundo agente (QA) y auditoría OWASP (A01, A03, A05, A08) según task-15.
- Actualizar el estado de `task-15.md` a `test` y después a `finalizada` solo con la evidencia.
