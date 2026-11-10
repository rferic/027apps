# Spec: rendimiento medible de la API y del panel

- **Fecha:** 2026-11-10
- **Estado:** aprobada por el usuario el 2026-11-10
- **Ámbito:** medir antes de tocar, fijar objetivos, corregir latencia de `/api/v1` y de las
  páginas, y eliminar llamadas duplicadas o en cascada
- **Relacionado:** [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
  [ADR 0007](../../adr/0007-manejo-de-errores.md) ·
  [`docs/infrastructure.md`](../../infrastructure.md) ·
  [`docs/flows/cicd.md`](../../flows/cicd.md) ·
  [`docs/tasks/sprint-14-mejoras/README.md`](../../tasks/sprint-14-mejoras/README.md)

## 1. Objetivo

Que una acción del panel (crear, guardar, activar) y una llamada a `/api/v1` respondan con una
latencia **medida y acotada**, con un antes/después reproducible y sin cambiar el
comportamiento observable.

El propietario percibe lentitud **al actuar** («cuando hago una acción parece tardar un poco»),
no solo al cargar. Por eso el alcance incluye la latencia de extremo a extremo de una acción,
no únicamente el TTFB de la ruta.

## 2. No objetivos

- Cambiar el stack (Next.js 16, Vercel Hobby, Supabase Free) ni pasar a planes de pago.
- Reescribir consultas por intuición: primero se mide; solo se toca lo que la medición señale.
- Cachear respuestas autenticadas. Ninguna optimización puede servir datos de un usuario a otro.
- Cambiar contratos de API o reglas de autorización.

## 3. Baseline medido (2026-11-10, producción)

Método: `curl -s -o /dev/null -w '%{time_starttransfer}'` contra
`https://027apps.ericrf.com`, 5 peticiones seguidas (caliente) desde España, y una tras un
periodo de inactividad (frío).

| Ruta | Caliente | Frío | Región de función (`x-vercel-id`) |
|---|---|---|---|
| `/api/health` | 353–740 ms | 1,82 s | `fra1::iad1::…` |
| `/api/v1/instance` (1 consulta) | 375–412 ms | 1,30 s | `fra1::iad1::…` |
| `/login` | 94–274 ms | 1,60 s | `fra1::iad1::…` |
| `/help/firebase` | 161–533 ms | — | `fra1::iad1::…` |

Hechos confirmados:

1. **Las funciones corren en `iad1` (EE. UU.)** y Postgres está en **`eu-west-2` (Londres)**:
   cada consulta paga un salto transatlántico de ida y vuelta (~75–90 ms). `fra1` es el POP de
   borde, no la región de cómputo.
2. **Doble verificación de sesión por request a `/api/v1`**: `proxy.ts` llama a
   `auth.getUser()` (red) y después a `getSession()` para reenviar el token; el *door*
   (`apps/admin/src/lib/api/door.ts` → `resolveCaller`) vuelve a llamar a
   `sessionClient.auth.getUser(jwt)` (red). Son **dos** llamadas a Supabase Auth por acción.
3. **`/api/health` no hace un ping**: llama a `auth.admin.listUsers({ perPage: 1 })`, una API de
   administración, para decidir `ok`/`degraded`.
4. Cold start de ~1,3–1,8 s, coherente con el tamaño del bundle de la función y la
   inicialización de Sentry/`pg`.
5. El *pool* de `pg` ya es singleton por instancia caliente (`getInfra()`), así que la
   reutilización de conexiones no es el problema; el problema es dónde corre y cuántas veces
   se llama a Auth.

Estos números son el **baseline contractual**: cualquier afirmación de mejora se compara con
esta tabla usando el mismo método.

## 4. Objetivos medibles (criterios de aceptación)

Medidos con el protocolo de §6, en producción, desde la misma red y con la misma cadencia.

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| `/api/v1/*` TTFB p95 **caliente** | ≤ 400 ms | 10 peticiones autenticadas por ruta; se descarta el primer hit; p95 |
| `/api/v1/*` TTFB p95 **frío** | ≤ 1.200 ms | primera petición tras 15 min sin tráfico o tras un deploy |
| Páginas del panel TTFB p95 caliente | ≤ 300 ms | `/panel`, `/invitations`, `/members`, `/settings` |
| Landing (tarea 03) | TTFB ≤ 100 ms en caché, LCP ≤ 1,5 s, CLS ≤ 0,1 | Web Vitals + `curl` |
| Acción de panel (clic → feedback) p95 | ≤ 700 ms | red del navegador: mutación + refresco |
| Peticiones por acción | Sin duplicados ni cascadas evitables | conteo en la pestaña Red |

Un objetivo no cumplido no se maquilla: se documenta el residual, la causa y la decisión.

## 5. Líneas de trabajo

Ordenadas por impacto esperado y riesgo. Cada una se valida con medición antes/después.

### L1 — Región de las funciones junto a la base de datos

- Declarar `regions: ["lhr1"]` en `vercel.json` (Londres, misma zona que `eu-west-2`) o fijar
  *Function Region* en el proyecto de Vercel.
- Verificar con `x-vercel-id` que el segundo segmento es `lhr1` y repetir la tabla de §3.
- Comprobar antes el límite de Hobby (una sola región) y que el dominio sigue sirviendo desde
  el POP de borde.
- Efecto colateral positivo: el cómputo y los datos quedan en la UE.

### L2 — Una sola verificación de sesión por request

- En `proxy.ts`, para `/api/v1`, **no** llamar a `auth.getUser()`: leer la sesión con
  `getSession()` (lectura de cookie, sin red) y reenviar el `access_token`. El *door* sigue
  verificando el JWT con `getUser()`: la autorización **no** se relaja, solo se deja de
  verificar dos veces.
- Validar el comportamiento de refresco: si el token está caducado, el refresco lo sigue
  resolviendo `@supabase/ssr`; si no fuera así, refrescar solo cuando `exp` haya vencido.
- Nunca confiar en una cabecera del proxy como prueba de identidad.
- Medir: −1 llamada de red a Auth por request.

### L3 — `/api/health` barato y honesto

- Sustituir `auth.admin.listUsers` por una consulta trivial a Postgres (`select 1`) a través
  del pool, o por un `HEAD` al endpoint REST de Supabase si se quiere cubrir también la API.
- Mantener el contrato: `200 {"status":"ok"}` / `503 {"status":"degraded"}` y sin detalles
  internos.
- Añadir timeout corto (2 s) para que el keep-alive no acumule funciones colgadas.

### L4 — Duplicados y cascadas en el cliente

Auditoría con la pestaña Red de una sesión real, sobre tres acciones representativas:

1. Crear una invitación.
2. Activar/desactivar un módulo.
3. Guardar ajustes de una sección.

Para cada una se registra: nº de peticiones, cuáles son duplicadas, cuáles en cascada
(esperar una para lanzar la siguiente) y cuáles podrían ir en paralelo. Se corrige lo evitable:

- doble `router.refresh()` o `refresh()` + invalidación redundante;
- refetch de datos que la mutación ya devuelve;
- peticiones que dependen de otra solo por orden de escritura, no por datos;
- efectos que se disparan dos veces (comprobar que no sea solo StrictMode en desarrollo).

Cada corrección debe dejar evidencia del antes/después del conteo.

### L5 — Cold start y peso de la función

- Medir el tamaño del bundle de la función de una ruta representativa y el tiempo de
  inicialización (Vercel Runtime Logs, `duration_ms` del *door* frente al TTFB).
- Revisar imports pesados en rutas de API (`@scalar/api-reference-react` solo debe cargarse en
  `/docs/api`; Sentry no debe arrastrar código a rutas que no lo usan).
- Solo se aplican cambios que la medición justifique; el objetivo es el frío de §4.

### L6 — Consultas

- Con el baseline en la mano, revisar N+1 reales en los listados del panel y en `/api/v1`
  (invitaciones, miembros, módulos, ajustes) mediante `EXPLAIN (ANALYZE, BUFFERS)` y conteo de
  consultas por request.
- Cualquier índice nuevo lleva su justificación y su migración; nada especulativo.

## 6. Protocolo de medición (repetible)

Se documenta en `docs/flows/performance.md` y se usa igual antes y después:

1. **Caliente**: 2 peticiones de calentamiento, 10 medidas, se reporta p50 y p95 de
   `time_starttransfer`.
2. **Frío**: tras ≥15 min sin tráfico o justo después de un deploy, la primera petición a la
   ruta, repetida 3 veces en deploys distintos.
3. **Autenticado**: cookie de sesión de una cuenta de prueba; nunca la del propietario.
4. **Acción**: grabación de la pestaña Red con *Preserve log*, contando peticiones y tiempos
   hasta el primer feedback visible (no hasta el último request).
5. Se anota la región observada (`x-vercel-id`), la fecha y el commit desplegado.

El flujo incluye la tabla de baseline y la tabla de después, para que la comparación no dependa
de la memoria de nadie.

## 7. Seguridad y guardarraíles

- **No** se debilita ninguna comprobación de identidad: L2 elimina una verificación redundante,
  no la única.
- **No** se cachean respuestas autenticadas ni se comparte el pool entre peticiones de distinto
  usuario a nivel de datos.
- Los logs siguen sin PII ni tokens (ADR 0007 y convención de logging).
- El cambio de región es configuración de despliegue: se documenta en
  `docs/infrastructure.md` y `docs/flows/cicd.md`, con permisos y secretos intactos.
- Las migraciones de índices llevan su `down` lógico documentado y se aplican por entorno.
- Toda optimización pasa la suite existente **sin modificar tests para que pasen**.

## 8. Criterios de aceptación

1. `docs/flows/performance.md` existe con el protocolo, el baseline de §3 y la tabla de después
   del sprint.
2. La tabla de §4 se cumple en producción o queda documentado el residual con causa y decisión.
3. `x-vercel-id` muestra `lhr1` como región de función.
4. Un request autenticado a `/api/v1` hace **una** verificación de JWT (evidencia en logs o en
   el test de integración del *door*).
5. El informe de duplicados de las tres acciones existe, con el conteo antes/después.
6. `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter admin build` en verde; CI del PR en
   verde.
7. Ningún test existente se modificó para acomodar una optimización.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| `lhr1` no disponible en Hobby | Comprobar límite antes de tocar; si no, documentar y atacar L2/L4/L5, que no dependen del plan. |
| Cambiar el proxy rompe el refresco de sesión | Test de integración del proxy con token caducado y válido; medir sesión de 15 min. |
| Optimizar sin medir y mover el problema | Cada cambio entra con su par antes/después; sin número no se mergea. |
| Ruido en las medidas (red doméstica) | Mismo origen, misma hora, 10 muestras y p95; se compara tendencia, no un único hit. |
| Coste/observabilidad | Sin plan Pro: se usan Runtime Logs y `curl`; no se depende de Observability Plus. |

## 10. ADRs aplicables

`0004` (bordes y capa de aplicación), `0007` (errores y logging). No se requiere ADR nuevo.
