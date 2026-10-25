# ADR 0005 — Estado y fetching del admin (patrón híbrido con dato inicial del servidor)

**Fecha:** 2026-10-25
**Estado:** Aceptada
**Decisora:** usuario (rferic), en conversación de diseño
**Base:** [ADR 0004](0004-bordes-y-capa-de-aplicacion.md) — el admin muta vía API routes (`/api/v1`), sin server actions; representación compartida
**Resuelve:** el ítem «estado y fetching» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md)

## Contexto

El admin (panel web, Next.js 16) consume su propia API (`/api/v1`, mismo deploy). Con el ADR 0004 ya se decidió que las mutaciones van por API routes. Queda la **lectura**: cómo el panel pinta los datos y refleja las mutaciones, con estados de carga/vacío/error.

La identidad del admin es un panel técnico y denso (OpenRouter) con tablas ordenables, KPIs, listados y acciones (revocar dispositivo, desactivar clave, invitar) que deben reflejarse sin recargar la página. Eso descarta el patrón puramente server-rendered con recarga por navegación como experiencia única, y descarta también el fetch puro en cliente sin dato inicial (arranque más lento: espera a hidratación + fetch del navegador).

## Decisión

Se adopta el **patrón híbrido (C) — "provided by the server"**: el servidor pinta la primera vista con el dato inicial y una librería de fetching en cliente se hidrata con ese dato y lo gestiona en vivo a partir de ahí.

1. **Lectura inicial en el servidor:** cada sección es un Server Component que obtiene su dato inicial llamando a su caso de uso de lectura (vía la API `/api/v1`, en el mismo deploy) y lo entrega a los Client Components como dato inicial de la librería. La primera impresión es inmediata (sin esperar a hidratación).
2. **Gestión en vivo en el cliente con librería de datos:** SWR (`useSWR` con dato inicial) o TanStack Query (`useQuery` + `HydrationBoundary`), según el criterio de la → sección «Elección de librería». La librería mantiene la caché del navegador, la revalidación de foco y las actualizaciones optimistas.
3. **Mutaciones → API routes → invalidación coordinada:** toda mutación va por `/api/v1` (ADR 0004). Al completarse, la librería actualiza su caché en el navegador con el resultado, y si el dato inicial vino de una lectura con caché del servidor se invalida esa lectura con el mecanismo disponible desde un route handler: **`revalidateTag(tag, { expire: 0 })`** para expiración inmediata, o **`revalidateTag(tag, 'max')`** si vale servir stale mientras se revalida. (`updateTag` queda **descartado**: la doc de Next 16 lo restringe a Server Actions, que este ADR y el 0004 prohíben — no es una opción en esta arquitectura.) **Una mutación optimista que falle restaura el valor anterior** del navegador (contrato de la librería).
4. **Estados de carga/vacío/error con los mecanismos de la librería** (`isLoading`/`error`/`data`), más los componentes del DS (skeletons, empty states) — fijado como patrón, no como librería concreta.
5. **No se usan server actions** (ADR 0004): el cliente nunca muta fuera de `/api/v1`.

### Elección de librería (decisión de builder con criterio fijado)

Ambas librerías (SWR y TanStack Query) soportan el patrón C en Next 16. Criterio de elección en el plan de implementación:

- Empezar con la que implique **menos configuración y menos estado** para el admin v1 (uso SWR: `useSWR(key, fetcher, { suspense: true })` con el dato inicial provisto por el **`<SWRConfig value={{ fallback: { [key]: dataInicial } }}>`** desde el Server Component — la clave de `fallback` y la de `useSWR` deben coincidir; el dato inicial es la `Promise` del servidor sin `await`).
- Elegir **TanStack Query si aparece un caso que lo justifique**: mutations complejas con invalidación por query key, deduplicación multi-componente, o necesidad de capa de cache con ciclo de vida rico. A escala admin v1 no se espera.
- La decisión queda en el plan; **no se adopta ninguna dependencia hasta el Core**, cuando exista el primer caso de uso real de lectura.

## Alternativas consideradas

- **A. Todo server-rendered (lecturas en Server Components, recarga por navegación):** descartado por el usuario — el panel necesita navegación fluida y reflejar cambios sin recargar (tablas, acciones, revocaciones en vivo).
- **B. Fetch puro en cliente (sin dato inicial):** descartado — arranque más lento (espera a hidratación + fetch); la doc de Next lo recomienda solo cuando la respuesta puede esperar (autocompletado), no para pantallas principales.
- **C (elegido). Híbrido — server provee el dato inicial + librería cliente:** primera vista inmediata y fluidez de app; coordenar la caché entre capas es el coste asumido (la doc lo advierte y el ADR fija la invalidación coordinada).

## Consecuencias

- Exige una dependencia nueva de fetching en cliente en el Core (SWR o TanStack Query), justificada por el patrón elegido — se adopta en el plan del Core, no antes.
- Los componentes del DS (DataTable, KPI card) se usarán con datos vivos de la librería (estados loading/error/empty desde el componente).
- Los estados de carga/vacío/error del admin quedan como patrón fijo (DS + librería), con su tarea de patrones UX del backlog.
- La invalidación coordinada (librería cliente ↔ caché servidor) queda fijada como requisito por este ADR: toda mutación termina actualizando la caché del navegador y, si procede, expirando la lectura de servidor con `revalidateTag`.