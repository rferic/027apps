# ADR 0006 — Realtime: Supabase Realtime con eventos de dominio publicados por la API

**Fecha:** 2026-10-25
**Estado:** Borrador para aprobación del usuario
**Decisora:** usuario (rferic), en conversación de diseño
**Base:** [spec de auth](../superpowers/specs/2026-10-25-auth.md) (Supabase = identidad + transporte) · [ADR 0004](0004-bordes-y-capa-de-aplicacion.md) (eventos tras el commit, representación compartida) · [ADR 0005](0005-estado-y-fetching-del-admin.md)
**Resuelve:** el ítem «Realtime» de la [spec de diseño §4](../superpowers/specs/2026-10-24-027apps-design.md), fijado como pendiente de la spec de auth en la task-03

## Contexto

La app móvil debe reaccionar a eventos al instante: **ej. estoy en la página de gastos familiares y mi pareja añade un gasto → lo veo sin recargar**. Requisito de **privacidad entre grupos**: el amigo X no debe recibir eventos que no le tocan.

La spec de auth (2026-10-25) ya decidió la frontera: el móvil se autentica con **Supabase Auth** y **Supabase Realtime es el transporte** — el canal envuelto por RLS por grupo. Este ADR fija el mecanismo concreto del canal, apoyándose en esas decisiones (no las reabre).

## Decisión

Se usa **Supabase Realtime (Broadcast) con eventos de dominio publicados por nuestra API tras el commit**, con aislamiento por grupo garantizado por RLS sobre `realtime.messages`.

1. **Publicación desde la API (no Postgres Changes):** cuando un caso de uso completa una transacción, **nuestra API publica un evento de dominio** (efecto externo **después** del commit, ADR 0004 §6) al **topic del grupo** (`group-<id>`). Decisión a favor de Broadcast/publicación desde la API y **no** de `postgres_changes`: el payload es un **recurso con la representación compartida** (ADR 0004 §7, mismo shape que el REST), no una fila cruda de la BD — coherente con "los datos solo por `/api/v1`" y con no exponer el esquema.
2. **Aislamiento por grupo en RLS sobre `realtime.messages`:** el móvil se suscribe al topic `group-<id>` con su sesión de Supabase y `config: { private: true }`; una política RLS (con `realtime.topic()` + pertenencia al grupo) decide quién puede unirse. **El amigo X no puede unirse al topic del grupo de mi pareja.** Es la misma infraestructura RLS que protege los datos — no un segundo modelo de permisos (decisión clave de la auth).
3. **Publicación desde el servidor:** la API publica al topic con credenciales de servidor de confianza; **el plan debe validar el mecanismo contra la doc vigente**, teniendo en cuenta que Supabase **depreca las claves `service_role`/`anon` a favor de `sb_secret_*` (finales de 2026)** — se espera que el plan aterrice en el mecanismo nuevo (`sb_secret_*`), no en `service_role`.
4. **Topología de topics:** **siempre** por grupo (`group-<id>`). Una suscripción a un topic sin permisos → rechazada; jamás se emite a "todos".
5. **Revocación acotada:** la autorización de una conexión Realtime abierta se cachea durante la conexión; con **`JWT_EXPIRY = 900 s`** (definido en la spec de auth), un miembro removido deja de recibir en ≤15 min. La revocación **de datos** (RLS/guard) sigue siendo inmediata en cada petición nueva al API.
6. **Cuándo aplica:** el realtime es para la **app móvil** (y, si lo justifica un caso, terceros con mecanismo explícito de la spec API v1). El **admin web no se suscribe por defecto**: su patrón es el ADR 0005 (revalidación). **El endpoint SSE propio queda descartado** como opción, como consecuencia de la frontera de la spec de auth (Supabase = transporte): fue aplazado en la task-03 a la espera de la spec de auth, y esta la resolvió eligiendo Supabase Realtime.
7. **Límites del Free (verificados, 2026-10-25):** Realtime incluido en el plan Free — 200 conexiones concurrentes pico, 2 M mensajes/mes, 256 KB/mensaje. Para una familia (4-6 dispositivos) el margen es enorme; no se espera coste.

### Frontera de responsabilidad (resumen)

| Pieza | Responsable |
|---|---|
| Transporte (WebSocket, entrega, mensajes, suscripción) | **Supabase Realtime** |
| Eventos de dominio (qué significa el cambio, payload con representación compartida) | **Nuestra API** (publicación tras el commit) |
| Aislamiento por grupo (quién puede unirse a qué topic) | **Política RLS** escrita por nosotros, evaluada por Supabase |
| Identidad de la suscripción | **Sesión de Supabase Auth** del móvil |

## Alternativas consideradas

- **SSE propio desde `/api/v1` (opción A de la conversación):** retirado. El reanálisis con la auth decidida mostró que aplicar Supabase Realtime es gratis, gestionado, Kotlin soportado (`supabase-kt`), y que su "coste" (autorización en RLS) desaparece — RLS ya protege los datos. El "guard único" del ADR 0004 sigue cubriendo los *datos*; el canal realtime es transporte gestionado, como quedó fijado en la auth.
- **Postgres Changes (el cliente escucha cambios de filas):** descartado — expondría el esquema de la BD al cliente y chocaría con "los datos solo por `/api/v1`" y con el payload como recurso. Broadcast con publicación desde la API mantiene el contrato y la representación.
- **Publicación desde una trigger/RLS de DB:** descartado — mezcla la capa de datos con el contrato de eventos; la publicación desde la API (donde ya vive la lógica de dominio, ADR 0004) es más directa y testeable.

## Consecuencias

- El contrato de eventos (nombres, payloads tipados, representación de cada recurso) se define en la **spec de API v1** (siguiente tarea), que referencia este ADR.
- El plan de implementación valida el mecanismo exacto de publicación servidor→Realtime (service-role broadcast vs alternativa) contra la doc vigente de Supabase antes de escribir código.
- `JWT_EXPIRY = 900 s` queda como configuración requerida de la instancia (paso del wizard de instalación).
- Las **políticas RLS de realtime** se escriben junto a las RLS de datos (misma pertenencia de grupo), no como un sistema aparte.
- El móvil Kotlin usa `supabase-kt` Realtime (canales privados); el admin web mantiene el ADR 0005.
- `presence`/chat quedan fuera de alcance (backlog futuro); aquí solo eventos de dominio.