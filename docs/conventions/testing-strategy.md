# Estrategia de testing

**Fecha:** 2026-10-25
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de diseño §4](../superpowers/specs/2026-10-24-027apps-design.md) (RLS en todas las tablas + suite de aislamiento) · [§7 stack](../superpowers/specs/2026-10-24-027apps-design.md) (Vitest, Playwright, Detox/Maestro, Storybook) · [§12](../superpowers/specs/2026-10-24-027apps-design.md) (algoritmos portados con tests propios) · [ADR 0004](0004-bordes-y-capa-de-aplicacion.md) (tests a dos niveles: caso de uso y puerta) · [ADR 0007](0007-manejo-de-errores.md) (tests de puerta: envelope + sin fuga de internos) · [ADR 0008](0008-fechas-y-moneda.md) (helpers de dinero testeados, check i18n) · [DoD](../conventions/definition-of-done.md) (TDD, `adrs:` en frontmatter)
**Resuelve:** el ítem «Estrategia de testing: unit/integración/E2E/RLS/visual, coverage mínimo, fixtures» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md)

## 1. Principios

1. **TDD obligatorio** (DoD): el test se escribe primero, rojo → verde → refactor. Para bugfix, un test de regresión que falla sin el fix.
2. **Determinismo antes que agentes** (spec §9): el CI decide lo mecánico. Un test que falla es un build rojo, no un debate.
3. **Testear el contrato, no la implementación**: los tests verifican comportamiento observable (casos de uso, contrato de puerta, representación), no detalles internos que invitan a refactors que rompen tests sin cambiar comportamiento.
4. **Los tests son código de producción**: mismos estándares (lint, typecheck, sin `any`, sin colores hardcodeados), legibles y mantenibles.

## 2. Niveles y qué se testea en cada uno

La arquitectura de capa de aplicación (ADR 0004) fija el esqueleto: los tests se escriben a dos niveles — **caso de uso** (lógica y transacciones, sin HTTP) y **puerta** (contrato zod, autorización, representación). Sobre eso, la pirámide completa:

| Nivel | Qué cubre | Herramienta | Dónde corre |
|---|---|---|---|
| **Unit (dominio/casos de uso)** | Reglas de negocio, invariantes, transacciones, redondeo/conversión de dinero (ADR 0008), helpers | Vitest | `packages/*` |
| **Unit (componentes)** | Componentes del DS con sus estados (loading/error/empty), a11y básica | Vitest + Testing Library + Storybook | `apps/admin` |
| **Integración (puertas)** | Contrato zod en el borde, autorización (`authorize(caller, scopes)`), representación del recurso, envelope de errores y **ausencia de fuga de internos** (ADR 0007), mapeo HTTP | Vitest (route handlers con request fabricados; sin levantar servidor) | `apps/admin` + `packages/*` |
| **RLS/aislamiento** | **D2**: suite SQL por tabla (un miembro del grupo A **no** puede leer/escribir/unirse a lo del grupo B; cada tabla con `group_id` scoped) **+ script de aislamiento con dos grupos** que siembra dos grupos con datos que comparten emails/fechas y verifica la separación de punta a punta (RLS **y** contrato de la API: nunca se filtra el grupo vecino) | Supabase local (tests SQL unit de políticas RLS + script) | CI — job `supabase`/`rls` a añadir en infra (hoy no existe; `cicd.md` se actualiza al añadirlo) |
| **E2E web** | **C1 — smoke mínimo**: login, wizard de instalación, invitación, revocar dispositivo. Puerta abierta a listados (DataTable/KPI con datos vivos) cuando el admin tenga su primer listado real | Playwright (proyecto `web`, dentro de la config de `apps/admin`) | CI + preview del PR |
| **E2E móvil** | Flujos críticos del móvil (emparejamiento por invitación, ver gastos al instante con realtime, login una vez) | **Maestro** (elegido, 2026-10-25; Detox solo si la suite E2E móvil crece y lo justifica — decisión aplazada, no cerrada) | CI (job `android`) |
| **Visual/regresión** | Componentes del DS en claro/oscuro, contraste (no hardcodear colores; tokens semánticos) | Storybook (interaction tests) + snapshot ligero | CI |

**Estrategia por capa de la API** (ADR 0004):
- **Caso de uso**: se testea sin HTTP (entrada + dependencias inyectadas). Cubre las reglas de negocio y el comportamiento transaccional (rollback si lanza, efectos externos tras el commit).
- **Puerta**: se testea el route handler con peticiones fabricadas — zod rechaza malas entradas, el guard autoriza/deniega por scopes, la representación coincide con el recurso compartido, los errores salen en el envelope del 0007 sin internos.

## 3. Fixtures y datos de prueba

1. **Factories tipadas** por entidad (grupo, miembro, gasto, invitación…) en el paquete compartido de tests **`packages/test-utils`**, reutilizadas por Vitest, Playwright y scripts RLS. Sin copiar datos de fixture por proyecto.
2. **Un family-set estándar**: un grupo "familia" con 4 miembros (incluida la pareja y un ficticio), moneda EUR (ADR 0008), usado como base de escenarios realistas (gastos, balances, splits con residuo).
3. **Fixture por escenario de error** (ADR 0007): entradas zod inválidas, invitación caducada, miembro sin scope, grupo inexistente, recurso de otro grupo.
4. **Seeds deterministas (D2)** para RLS: datos de **dos grupos distintos** que comparten emails, fechas y montos para demostrar aislamiento real — no accidental — tanto en RLS como a través de la API (script de aislamiento de punta a punta).

## 4. Coverage y umbrales

La spec §7 deja "coverage con umbral (se fija en el primer sprint)": este documento lo fija.

| Área | Umbral (líneas / ramas) | Nota |
|---|---|---|
| `packages/*` casos de uso + helpers de dominio (incl. dinero/fechas) | **90 % / 80 %** | El corazón del negocio; las sumas deben cuadrar siempre (ADR 0008) |
| Puertas (route handlers, contratos) | **85 % / 75 %** | Contrato de API y autorización |
| RLS | No aplica cobertura; **suite de aislamiento obligatoria por tabla + script de dos grupos (D2, sección 2)** | La cobertura de SQL no aporta; se exige la suite de aislamiento |
| Componentes del DS | **80 % / 70 %** | Vía Vitest + Storybook |
| E2E (web/móvil) | No coverage; **caminos críticos obligatorios** | Los E2E no miden cobertura, cubren flujos |
| Global de `apps/admin` | Sin umbral global concreto en v1 | Evita falsa seguridad: se garantiza por las capas de arriba, no por un número global |

Los umbrales se aplican por **conjunto de archivos** (coverage de Vitest por path), no al proyecto entero, para que no se diluyan. El CI falla bajo el umbral en el job `admin` (que ejecuta Vitest). El job `android` corre `:app:testDebugUnitTest` (tests unitarios Kotlin, sin cobertura); si algún día se fija cobertura Kotlin, se añade con su umbral propio.

## 5. Cumplimiento de ADRs en los tests (lo mecánico de cada decisión)

Cada ADR deja un "contrato testable"; la tarea los declara en su frontmatter `adrs:` (DoD):

- **ADR 0007 (errores)**: test de puerta que verifica el envelope (code/message/request_id/details) y que **ninguna respuesta contiene SQL, stack traces, rutas internas o secrets** — ni en dev.
- **ADR 0008 (fechas/moneda)**: test de los helpers de redondeo determinista y conversión (la suma de un split = el total, siempre); validation zod de `amount_minor` (entero) y `currency` (ISO 4217); formatos ISO 8601.
- **ADR 0006 (realtime)**: test de RLS de `realtime.messages` (un no-miembro no puede unirse al topic del grupo) + test de que la API publica el evento **tras** el commit y con la representación compartida.
- **ADR 0005 (admin fetching)**: test de la librería de fetching con dato inicial del servidor (fallback correcto, invalidación coordinada).
- **ADR 0004 (bordes)**: test de puerta que todo cambio de lógica de negocio pasa por el caso de uso y no por el transporte (por construcción en los tests de nivel).

## 6. Test de i18n (enlaza ADR 0008 y el flujo i18n)

- El check de CI falla si los locales del **set commiteado en el repo** (los que el código es capaz de servir) no tienen exactamente las mismas claves — determinista en CI, sin depender de `instance_settings` runtime (ADR 0008, Nivel 1); los deshabilitados en una instancia concreta no se sirven.
- Test unit de los textos de error mapeados a cada locale (`error.<code>`, ADR 0007).

## 7. Qué NO se testea (y por qué)

- **Sin tests de snapshot masivos** de componentes (frágiles y ruidosos); se prefiere interaction/behavior testing. Snapshots ligeros solo para regresión visual puntual.
- **Sin tests E2E de todo**: solo caminos críticos; el resto se cubre en los niveles inferiores (más rápidos y precisos).
- **Sin duplicar la cobertura**: lo ya cubierto en el caso de uso no se re-testea en la puerta (la puerta testea contrato/autorización, no reglas).
- **Sin testear la BD de Supabase directamente en unit**: las consultas se testean como parte del caso de uso (dependencia inyectada) y el aislamiento real se cubre en la suite RLS (los «SQL unit» de la sección 2 son tests de **políticas RLS**, no unit de la aplicación).

## 8. Consecuencias

- El Core arranca con `packages/test-utils` (factories + family-set) y los umbrales de la tabla 4 configurados en Vitest desde la primera tarea.
- La suite RLS de aislamiento es parte de la definición de terminado de toda tabla nueva (spec §4) — el CI la incluye.
- Los E2E web se añaden como proyecto Playwright al `apps/admin`; los E2E móviles al job `android` del CI ([`cicd.md`](../flows/cicd.md)) cuando el Core tenga los flujos críticos.
- La estrategia se revisa cuando aparezca el primer módulo con lógica real (Split Expenses) para confirmar los umbrales contra la realidad, sin bajar los del dominio (90/80).

## 9. Testing asistido por IA con Playwright (decisión pendiente — se diseña en el Core)

Hoy la estrategia asume TDD + agentes escribiendo los tests y el CI como juez determinista («determinismo antes que agentes»). No hay nada configurado aún para que una IA genere o repare tests con Playwright; queda anotado como **decisión pendiente a diseñar cuando exista el primer Playwright real** (en el arranque del Core, cuando `apps/admin` tenga flujos críticos que testear — sección 2, C1).

**Dirección prevista** (a confirmar en el Core, no cerrada):

1. **Generación asistida de E2E**: el agente redacta los E2E Playwright desde los criterios de aceptación de la spec del recurso/flujo (los mismos que usa el TDD), y Playwright los ejecuta en CI. Si un cambio de UI los rompe, el agente los actualiza en el mismo PR (el CI decide si pasan; el agente no "salta" el check).
2. **Skill de proyecto** `e2e-web` (spec §11, skills): patrón de escritura de E2E (locators por data-test, estados loading/error/empty, fixtures del family-set) para que cualquier agente produzca tests coherentes sin depender de memoria.
3. **Opcional — driver visual para el agente**: un MCP de Playwright en el harness (si el agente necesita "ver" el navegador para depurar un test roto), evaluado cuando haya un caso real que lo justifique. No se adopta ninguna dependencia antes de ese punto (política del repo: dependencias nuevas solo con caso real, ADR 0005 §elección de librería).

**Límites que se mantienen**: la IA escribe/actualiza los tests; **no** decide si el build pasa (lo decide el CI) ni baja umbrales de cobertura (tabla 4). El veredicto final sigue siendo determinista.

**Dónde se decide:** se fija cuando se monte el proyecto Playwright del Core; esta sección no lo cierra para no adelantar decisiones sin el primer caso real.
