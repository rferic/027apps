# Instalar módulos desde el panel — diseño

**Tarea:** `docs/tasks/sprint-06-web/task-15.md` · **Plan:** `docs/superpowers/plans/2026-11-08-module-install.md`

## Problema

`/modules` lista los módulos instalados y la ficha permite desinstalar, pero instalar exige el API con
sesión o una clave de servicio desde CLI. El panel no tiene instalador.

## Descubrimiento de paquetes

- `listModulePackages()` (`apps/admin/src/lib/module-packages.ts`) lee `MODULES_ROOT`, el mismo
  directorio que usa `lib/modules.ts` (por defecto `packages/` de la raíz del monorepo).
- Recorre solo subdirectorios de primer nivel. Para cada uno lee `manifest.json` y lo valida con el
  schema del Core antes de mostrarlo.
- Un paquete es **instalable** si el manifest es válido y su `key` coincide con el nombre del
  directorio. Si no, se devuelve con `valid: false` y un `reason` legible; la página no falla.
- Se excluyen los paquetes cuya `key` ya figura en la lista de módulos instalados del Core.

## Qué se valida y dónde

- **Disco del servidor = fuente de verdad.** El manifest nunca viaja desde el cliente: la server action
  recibe solo la `key` (validada con zod) y el Core vuelve a leer y validar el paquete.
- La validación final la hace el Core en `POST /api/v1/modules/{key}/install`; el panel la refleja con
  el mismo schema para deshabilitar lo que el Core rechazaría.
- Solo `admin` puede instalar (`requirePanel("admin")` y el guard del Core).

## Qué no se muestra

- Rutas absolutas del sistema de ficheros: el listado usa solo `key`, `name`, `version`, `description` y
  un motivo de error en texto.
- Contenido del manifest que no sea metadato de listado.
- Detalles internos de errores de disco: se devuelve un motivo genérico.

## Errores

- 409 → «ya está instalado» (instalar dos veces no duplica).
- 400 → manifest inválido, con el motivo del Core.
- 403 → mensaje genérico de permiso.
- Todos los errores incluyen `request_id` (ADR 0007).

## Fuera de alcance

Descarga o subida de paquetes, marketplace, firma de paquetes y la UI de ajustes de módulo.
