---
id: sprint-15-task-02
titulo: Módulo — instalación, aislamiento y scopes
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-11-13-module-runtime.md
fuente: docs/ai/module-system.md; docs/superpowers/specs/2026-10-26-modulo-system.md §4; docs/superpowers/specs/2026-10-26-core-api.md §3.1
adrs: [0007]
---

**Tarea**: hacer que un módulo instalado sea un ciudadano seguro de primera clase: privilegios
mínimos sobre su esquema, identidad para RLS sin `security definer`, scopes resueltos por
petición y una regla de claves foráneas que no rompa el borrado definitivo de un usuario. Probar
el ciclo con un módulo de fixture. **No** entra el panel (tarea 03), ni realtime (tarea 04), ni
la demo (tarea 05).

**Alcance**
- Dentro:
  - Tras aplicar las migraciones, conceder a `service_role` y `authenticated` `usage` sobre el
    esquema `module_<key>` y DML sobre sus tablas/secuencias; el DDL del módulo sigue sin poder
    hacer `GRANT`. Verificar que antes de instalar no hay acceso y después sí.
  - **Helper de identidad para RLS**: el DDL no puede escribir `auth.uid()`
    (`assertSafeModuleSql` prohíbe el esquema `auth`) ni crear funciones `security definer`.
    Exponer una función compartida y segura que el módulo pueda usar sin cualificar
    (`core_current_user_id()` o equivalente), con `search_path` controlado, y tests de que un
    módulo no puede leer ni escribir fuera de su esquema.
  - **Scopes de módulo por petición**: `has_module_access` + scopes del manifest para sesiones y
    claves delegadas; sin grant → `403`; módulo inactivo → `403`/`404` uniforme. El guard no
    abre scopes de Core.
  - **Claves foráneas a `profiles` (D16)**: `purgeUser` borra `auth.users` y solo pone a `null`
    las referencias de `public.*`. Toda FK de módulo a `profiles(id)` va con
    `on delete set null`; se valida en el DDL y se prueba purgando un usuario con datos del
    fixture. Sin la regla, el borrado **falla** por clave foránea.
  - Módulo de **fixture** mínimo en `db-tests`: una tabla, una política RLS con el helper, un
    endpoint con scope y datos que apunten a un usuario.
- Fuera: host de páginas de panel y empaquetado (03); canal y push (04); demo (05); widgets
  (03); settings (03); OweNo (06).

**Dependencias**: ninguna. Puede ejecutarse en paralelo con la tarea 01. Las tareas 03, 04 y 05
dependen de esta.

**Riesgos**: los grants son superficie de seguridad y deben ser mínimos; el helper de identidad
no puede filtrar filas de otros esquemas; el guard no debe abrir scopes de Core; la regla de FK
puede chocar con módulos ya instalados (no hay ninguno todavía).

**Criterios de aceptación**
- Un módulo de fixture se instala, activa, consulta y desinstala en `db-tests` sin tocar el Core
  manualmente.
- Un usuario con grant activo llama a un endpoint de módulo con su scope; sin grant recibe
  `403`; un módulo desactivado no se sirve.
- El fixture escribe una política RLS con el helper y la suite de aislamiento demuestra que un
  usuario de otro grupo no ve ni modifica sus filas.
- Un usuario con datos del fixture se desactiva y se purga: el borrado termina sin error de
  clave foránea y las filas del módulo sobreviven sin `user_id`.
- `docs/ai/module-system.md` y `docs/flows/new-module.md` actualizados con el helper, los scopes
  y la regla de FK; `docs/api/README.md` con el comportamiento de `403/404`.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter db-tests test` en verde; CI en verde.

**Puertas de usuario**
- Aprobar el plan.
- Autorizar la instalación del fixture en el preview de staging (sin datos reales).
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (grants, helper de identidad,
aislamiento entre esquemas y scopes por petición).
