---
id: sprint-06-task-15
titulo: Instalar módulos desde el panel
area: web
estado: test
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-08-module-install.md
spec: docs/superpowers/specs/2026-11-08-module-install-design.md
---

**Alcance**: `/modules` lista los módulos instalados y la ficha desinstala, pero no hay forma de
instalar desde el panel. Hoy hay que usar el API con sesión o una clave de servicio, lo que obliga a
CLI. El `debug` de pruebas lo demostró. Esta tarea añade `/modules/install`, que lista los paquetes
presentes en `MODULES_ROOT` que todavía no están instalados y los instala llamando en proceso a
`POST /api/v1/modules/{key}/install`.

## Cambios

### Panel

- **`apps/admin/src/lib/module-packages.ts`** — `listModulePackages()`: lee `MODULES_ROOT` (el mismo
  directorio que `lib/modules.ts`), recorre sus subdirectorios, parsea `manifest.json` y devuelve por
  paquete `{ key, name, version, description, valid, reason? }`. Nada de confiar en el disco: un
  manifest inválido o un directorio cuyo nombre no coincide con `key` se marca como no instalable con su
  motivo, y **no** rompe la página.
- **`/modules/install`** (nueva): `requirePanel("admin")`, `instant = false`. Lista los paquetes **no
  instalados** (contrastando con la lista del Core), con nombre, clave, versión y descripción. Botón
  **Install** por paquete; los inválidos se muestran deshabilitados con el motivo. Estado vacío cuando
  no hay nada que instalar. Tras instalar, redirige a `/modules/{key}`.
- **Server action** que llama **en proceso** a `POST /api/v1/modules/{key}/install` con el Bearer de la
  sesión (patrón de `lib/panel-keys.ts`), no a SQL. Errores mapeados: 409 ya instalado, 400 manifest
  inválido, 403 sin permiso; con `request_id`.
- **`/modules`**: acción primaria **Install module** que enlaza a `/modules/install`.
- i18n en los 9 idiomas.

### Core

Sin cambios de contrato: se reutiliza `POST /api/v1/modules/{key}/install` tal como está.

## Fuera de alcance

- Descarga o subida de paquetes desde el panel (solo paquetes ya presentes en `MODULES_ROOT`).
- Marketplace.
- Firma de paquetes.
- La UI de ajustes de módulo.

## TDD

- `listModulePackages`: directorio vacío, manifest inválido, key que no coincide con el directorio,
  paquete ya instalado excluido.
- Server action: éxito, 409, 400, 403.
- Página `/modules/install`: lista, deshabilitados con motivo, estado vacío, 403.
- `/modules`: acción primaria presente y enlazada.

## DoD

- DoD de Código completo: TDD, `pnpm lint && pnpm tsc && pnpm test`, `pnpm --filter admin build`,
  `pnpm i18n:check` y CI en verde.
- ADR 0004 (puertas delgadas, zod en el borde, representación compartida), 0005 (dato inicial del
  servidor y fetching en cliente) y 0007 (envelope y `request_id`) respetados.
- QA de segundo agente.
- **Auditoría OWASP obligatoria**, centrada en:
  - **A01**: solo admin instala; el panel no permite saltarse el guard del Core.
  - **A03**: el manifest viene del disco del servidor, nunca del cliente; validación con el schema del
    Core antes de instalar.
  - **A05**: el listado no expone rutas absolutas del sistema.
  - **A08**: los paquetes son de confianza porque `MODULES_ROOT` es un directorio del servidor.

## Criterios de aceptación

- Desde `/modules` se llega al instalador.
- Un paquete válido se instala y aparece en la lista.
- Un paquete inválido no se ofrece y explica por qué.
- Instalar dos veces no duplica: el 409 se explica al usuario.
- Sin permiso, 403 genérico.

## Dependencias y decisiones tomadas

Se apoya en task-05 (shell y `/modules`) y en task-14 (fichas de detalle `/modules/{key}`, a donde
redirige la instalación).
