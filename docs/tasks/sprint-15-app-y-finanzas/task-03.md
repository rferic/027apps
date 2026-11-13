---
id: sprint-15-task-03
titulo: Módulo — host de panel, ajustes y empaquetado
area: core
estado: en curso
plan: docs/superpowers/plans/2026-11-13-module-runtime.md
fuente: docs/ai/module-system.md; docs/superpowers/specs/2026-10-26-admin-shell.md §6; docs/superpowers/specs/2026-10-26-modulo-system.md §6
adrs: [0004, 0007]
---

**Tarea**: que un módulo se vea y se configure dentro del panel que ya existe, y que su paquete
llegue al bundle serverless. Incluye el contrato de widgets, los settings con rango y control y la
entrada del módulo por su resumen.

**Alcance**
- Dentro:
  - Servir `packages/<key>/admin/<route>/page.tsx` en `/modules/<key>/<route>` con un registro
    estático generado en build, gate por rol (`admin`/`super_admin`) y estado `active`.
  - **Entrada del módulo (D20)**: `/modules/<key>` redirige a `overview` si el módulo está
    `active` y la declara; si no, muestra la ficha. La ficha se mueve a `/modules/<key>/settings`
    y `settings` queda **reservada** (un `admin_pages.route` con ese nombre falla). La lista de
    módulos gana **Abrir** y **Ajustes**.
  - **Contrato de widgets (D10)**: el manifest declara `dashboard_widgets` (`key`, `type`,
    `title`, `icon`, `order`, `surface`); `GET /api/v1/me/dashboard` compone los de los módulos
    activos con acceso, sin HTML/JS del módulo.
  - **Settings con rango y control (D3.7)**: `min`, `max`, `step` y `control`
    (`number`|`slider`) para `int`, validados en servidor, y **formulario editable** en la página
    del módulo (hoy solo muestra valores), accesible y con el valor actual.
  - Empaquetar los módulos para Vercel: copia de `manifest.json`, `sql/`, `docs/`, `admin/`,
    `locales/` y assets, `MODULES_ROOT` y `outputFileTracingIncludes`.
- Fuera: grants, identidad y scopes (02); canal y push (04); demo (05); OweNo (06).

**Dependencias**: tarea 02 `finalizada` (el módulo debe poder instalarse y autorizarse).

**Riesgos**: el host necesita imports estáticos (Next/Turbopack no bundlea rutas arbitrarias); el
empaquetado no debe duplicar secretos ni datos; la ruta `settings` reservada puede chocar con un
módulo que ya la use (no hay ninguno); el formulario editable toca settings de módulo y debe
respetar secretos.

**Criterios de aceptación**
- La página de admin del fixture se renderiza en `/modules/<fixture>/<route>` solo si está
  `active` y el rol alcanza; una página de otro módulo no es accesible.
- `/modules/<fixture>` lleva a `overview`; la ficha vive en `/modules/<fixture>/settings`; un
  manifest con `route: "settings"` falla en CI.
- El fixture declara un widget, `GET /api/v1/me/dashboard` lo devuelve solo a quien tiene acceso
  y el contrato rechaza un `type` desconocido o HTML.
- Un setting `int` con `min`/`max`/`step` se edita con deslizador; un valor fuera de rango se
  rechaza en servidor con `validation_failed`; un manifest con `min > max` o `default` fuera de
  rango falla en CI.
- `next build` y un preview de Vercel incluyen el paquete; instalar el fixture desde el panel
  funciona en el preview.
- `docs/ai/module-system.md`, `docs/ai/manifest.schema.json`, `docs/flows/new-module.md`,
  `docs/flows/cicd.md` y los envoltorios actualizados; ejemplos del contrato de widgets y de
  settings con rango.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter db-tests test` y
  `pnpm --filter admin build` en verde.

**Puertas de usuario**
- Aprobar el plan.
- Autorizar la instalación del fixture en el preview.
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (páginas same-origin, gate de rol,
secretos en settings, exposición de ficheros del paquete).
