# ADR 0004 — Bordes y capa de aplicación: casos de uso, puertas, autorización y representación

**Fecha:** 2026-10-25
**Estado:** Aceptada
**Decisora:** usuario (rferic), en conversación de diseño
**Resuelve:** el ítem «Patrones arquitectónicos por ADR: server actions vs API routes» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md)

## Contexto

El Core va a exponer operaciones por varios caminos: la **API `/api/v1`** (móvil y terceros, API-first obligatorio según la spec), **MCP** (tools con scopes por módulo, ya previsto en la spec) y potencialmente **comandos/scripts de admin**. El admin web también muta datos. Sin una decisión, cada camino reimplementaría su propia lógica de negocio, validación y permisos — el anti-patrón de la spec §12 (duplicación y "convenciones en la cabeza").

Dos extremos a evitar:
- Que la lógica de negocio viva en el transporte (route handlers / server actions / tools), duplicada por camino.
- Que cada puerta valide permisos a su manera (entradas que "se olvidan" de autorizar).

## Decisión

Se adopta una **arquitectura de capa de aplicación (casos de uso) con puertas de entrada delgadas**. El modelo, en orden de ejecución en cada petición:

1. **Puerta de entrada delgada** (route handler de `/api/v1`, tool MCP, comando): recibe la petición, **autentica**, y comprueba la **autorización** contra los scopes que **declara la acción que expone** (ver 2). No contiene reglas de negocio.
2. **Autorización centralizada en un guard compartido.** Toda puerta llama al mismo autorizador (`authorize(caller, scopes)`). **Los scopes se declaran por acción expuesta**, no por caso de uso: una acción (ej. "registrar usuario") puede requerir varios scopes (`users:create` + `permissions:assign`). La puerta lee esa declaración de la acción que expone; el guard la comprueba. **Ninguna puerta puede saltarse el guard** (es requisito estructural, no de memoria).
3. **Validación de forma con zod en el borde** de cada puerta (contrato de entrada); los **invariantes de dominio** se validan dentro del caso de uso. **El caso de uso no confía en que el borde validó** (una entrada futura sin zod no debilita el dominio).
4. **Casos de uso como único sitio de la lógica de negocio.** Cada acción de negocio es un caso de uso. Un caso de uso **básico** hace una sola cosa (`crearUsuario`). Un caso de uso **orquestador** compone otros (`registrarUsuario` = `crearUsuario` + `asignarPermiso`) — la composición **nunca** se reensambla en la puerta: es un caso de uso con nombre, testeable y reutilizable por cualquier puerta (la tool MCP y el endpoint llaman al mismo `registrarUsuario`).
5. **Autorización en dos niveles:** el nivel de **acción** (¿puede este llamador ejecutar estos casos de uso?) lo decide la puerta contra el guard. El nivel de **datos/ownership** (¿puede invitar *a este grupo*?) vive con el caso de uso, porque depende de datos que solo él lee. RLS en BD como segunda barrera. Los casos de uso internos **no re-verifican "quién me llama"**: confían en la puerta (un chequeo único evita descuadres); reciben la identidad ya resuelta del llamador como parámetro cuando la necesitan.
6. **Transacciones por caso de uso orquestador, patrón Laravel** (`DB::transaction` como default: envuelve el trabajo; si algo lanza, rollback; si no, commit). El orquestador declara su atomicidad (todo-o-nada por defecto; la excepción es una decisión consciente). **Los efectos externos** (email de bienvenida, notificaciones) **nunca viven dentro de la transacción**: se envían tras el commit — si fallan, no se revoca el dato.
7. **Capa de representación compartida.** La salida no es la fila de la BD: es un **recurso** con forma explícita (campos devueltos, ocultos, formato), producido por una capa de serialización **compartida por todas las puertas** — la tool MCP y el endpoint devuelven la **misma forma** del recurso. El caso de uso devuelve resultado de dominio puro; la representación es del borde. Cumple el requisito OWASP de "respuestas sin campos de más" y alinea API/MCP.
8. **El admin muta vía API routes (`/api/v1`).** No se usan **server actions** para lógica de negocio: las puertas del sistema son los route handlers de `/api/v1`, las tools MCP y los comandos. (Server Actions de Next quedan descartadas como puerta: añadirían una superficie más que delegaría en los mismos casos de uso sin aportar nada que las API routes no den — y su doc exige autorización/validación por app en cada action, duplicando el borde.)

### Consecuencia sobre el modelo de tokens (spec 2026-10-25)

La spec de tokens fija scopes "por endpoint". Con este ADR se precisa: los scopes se declaran **por acción expuesta** en cada puerta (la puerta declara la lista de scopes que exige; el guard los comprueba). Una acción puede requerir varios scopes. El resto del modelo de tokens (opacos + BD, revocación instantánea, permisos por petición) no cambia.

## Alternativas consideradas

- **Server actions para el admin + API routes solo para móvil/terceros (híbrido):** descartado — dos superficies, validación y autorización duplicadas, el sistema de tokens no auditaría al admin, y contradice el API-first de la spec.
- **Autorización dentro de los casos de uso (cada caso de uso comprueba quién puede llamarlo):** descartado por el usuario — una puerta puede orquestar varios casos de uso y cada puerta tiene su contexto; el responsable del chequeo es la puerta de entrada, no la lógica de negocio. Un chequeo por caso de uso se descuadra entre puertas.
- **Reensamblar la composición en la puerta (el endpoint suma sus propios casos de uso):** descartado — la composición debe ser un caso de uso con nombre (testeable, reutilizable, auditable) para que API y MCP no concatenen distinto.
- **Representación por puerta (cada puerta formatea a su manera):** descartado por el usuario — se eligió **compartida** para que API y MCP devuelvan la misma forma del recurso.
- **Transacciones en la capa de transporte:** descartado — la atomicidad la declara el caso de uso orquestador (decisiones de dominio), no el HTTP.

## Consecuencias

- El Core se estructura en: `apps/admin/src/app/api/v1/**` (route handlers) + `packages/*` (casos de uso, autorizador, esquemas zod, recursos) + contrato OpenAPI generado desde los schemas.
- **Estado y fetching del admin** (cómo el panel consume su propia API) queda como ADR siguiente (§11) — consecuencia directa de que el admin vaya por API routes.
- Los ADRs restantes del §11 (manejo de errores, fechas y moneda, validación) se escriben sobre esta base.
- Los tests se escriben a dos niveles: **caso de uso** (reglas y transacciones, sin HTTP) y **puerta** (contrato zod, autorización, representación).
- El `guard-secrets` del CI no cambia; la spec de tokens ya exige tokens opacos sin loguear.
- El admin no usa server actions; la doc de Next 16 sobre el tema queda como referencia de lo descartado.