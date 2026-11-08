---
id: sprint-06-task-15
titulo: Instalar módulos desde el panel
area: web
estado: finalizada
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

## Reservas aceptadas

Hallazgos bajos de la auditoría que **no** se corrigen en esta tarea:

- **`moduleRoot` no hace contención de symlinks** (`apps/admin/src/lib/modules.ts`): un enlace simbólico
  dentro de `MODULES_ROOT` puede resolver fuera del directorio de paquetes. Hoy solo se leen rutas
  derivadas de `readdir` en un directorio de confianza del servidor, pero la contención real
  (`realpath` + prefijo permitido) pertenece al cargador de Core; se corrige en la tarea de Core.
- **`installModule` no escribe `admin_actions`** pese a A09: la instalación desde el panel no deja rastro
  de auditoría. Ese registro es deuda de Core: la tabla y su escritura pertenecen al cargador/API, no a
  la capa de panel.
- **`INSTALLED_PAGE_LIMIT=100` frente a `MAX_LIST_LIMIT`** (`/modules/install`): se contrasta contra una
  sola página de instalados, así que con más de 100 módulos los antiguos reaparecerían como instalables
  y el usuario recibiría un 409 al pulsar (se explica, no se rompe nada). Se pagina cuando exista ese
  volumen.

Además, la duplicación de `INTERNAL_ORIGIN`, `isRecord` y `sessionToken` entre
`apps/admin/src/lib/module-install.ts` y las demás llamadas en proceso se extraerá a
`lib/panel-route.ts` cuando se toque esa capa.

## Dependencias y decisiones tomadas

Se apoya en task-05 (shell y `/modules`) y en task-14 (fichas de detalle `/modules/{key}`, a donde
redirige la instalación).

## Cierre (2026-11-08)

- **Implementado**: `/modules` con acción primaria **Install module** → `/modules/install`, que descubre
  los paquetes de `MODULES_ROOT` (solo directorios con `manifest.json`), los valida con el schema del
  Core, excluye los instalados y muestra deshabilitados los inválidos con su motivo; server action que
  llama en proceso a `POST /api/v1/modules/{key}/install` (nunca SQL) y redirige a la ficha; estados de
  error 409/400/403 con `request_id`; estado vacío.
- **Evidencia**: `pnpm --filter admin test` ✓ (958), `pnpm --filter core test` ✓ (387), `pnpm lint` ✓,
  `pnpm tsc` ✓, `pnpm i18n:check` ✓ (558 cadenas, 9 locales), `pnpm --filter admin build` ✓ (ejecutado
  con el dev server parado y su salida leída; `/modules/install` se prerenderiza como dinámica),
  `/modules/install` responde 307 sin sesión.
- **Auditoría OWASP/QA**: veredicto **APTO CON RESERVAS**, sin hallazgos altos ni críticos.
  - A01: página y action con `requirePanel("admin")`; la acción solo es invocable con ese guard.
  - A03: el manifest sale siempre del disco del servidor, nunca del body, y se revalida con el schema del Core.
  - A05: el listado no expone rutas ni contenido de los paquetes.
  - A08: sin escape de `MODULES_ROOT`; los directorios sin manifest se omiten.
  - Resueltos los dos hallazgos medios: paquetes fantasma con el `MODULES_ROOT` por defecto y falta de
    test del botón (doble envío, `disabled`, `FormAlert`).
- **Reservas aceptadas**: las que constan en la sección «Reservas aceptadas» de esta tarea.
- **Pendiente de prueba manual**: instalar el `debug` desde el panel y comprobar que aparece en la lista
  y que la ficha abre correctamente. No bloquea el cierre de código.
