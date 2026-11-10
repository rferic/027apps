# Sprint 14 — Rendimiento medido (plan de implementación)

**Goal:** bajar la latencia de `/api/v1` y del panel con un antes/después reproducible, sin
cambiar contratos ni autorización. Objetivo: p95 ≤ 400 ms caliente y ≤ 1,2 s frío en API;
TTFB ≤ 300 ms en páginas del panel; una sola verificación de JWT por request.

**Spec:** [`2026-11-10-api-performance-design.md`](../specs/2026-11-10-api-performance-design.md)
(aprobada por el usuario el 2026-11-10).

**Tarea:** [`docs/tasks/sprint-14-mejoras/task-01.md`](../../tasks/sprint-14-mejoras/task-01.md).

**Baseline (2026-11-10, producción, `curl` desde España):**

| Ruta | Caliente | Frío |
|---|---|---|
| `/api/health` | 353–740 ms | 1,82 s |
| `/api/v1/instance` | 375–412 ms | 1,30 s |
| `/login` | 94–274 ms | 1,60 s |

`x-vercel-id: fra1::iad1::…` → funciones en `iad1`, Postgres en `eu-west-2`.

## Arranque

- [ ] Rama `sprint/14-invites-perf-landing`.
- [ ] PR del sprint en draft contra `staging` (se abre al primer commit del sprint).
- [ ] `apps/admin/AGENTS.md` leído: la documentación de Next 16 vive en
  `apps/admin/node_modules/next/dist/docs/`.

## Global Constraints

- Sin cambios de contrato de API ni de reglas de autorización.
- Ningún test existente se modifica para que pase.
- Cada cambio entra con su medida antes/después; sin número, no se mergea.
- Secretos y PII fuera de logs (ADR 0007).
- Cambios de Vercel son configuración reversible y se documentan en `docs/infrastructure.md`.

---

## Task 1 — Baseline y método repetible

- [x] Crear `docs/flows/performance.md` con el protocolo de la spec §6, la tabla de baseline y
  una sección «después» vacía.
- [x] Registrar el commit desplegado y la fecha de cada medida.
- [x] Comprobar qué rutas se pueden medir sin sesión (`/api/health`, `/api/v1/instance`) y
  anotar que las autenticadas requieren una captura del propietario o una cuenta de prueba.

**Verificación:** la tabla se reproduce con los comandos del flujo.

## Task 2 — L1: región `lhr1`

- [x] Añadir `apps/admin/vercel.json`:

  ```json
  { "regions": ["lhr1"] }
  ```

- [x] Fijar `serverlessFunctionRegion: "lhr1"` en el proyecto de Vercel (API/dashboard) y
  anotarlo en `docs/infrastructure.md`.
- [ ] Desplegar un preview y comprobar `x-vercel-id` (segundo segmento `lhr1`).
- [ ] Repetir la tabla de baseline en el preview.

**Verificación:** `curl -D - -o /dev/null <url> | grep x-vercel-id` muestra `lhr1`.

## Task 3 — L2: una sola verificación de sesión

- [x] **Test primero** en `apps/admin/src/proxy.test.ts`:
  - un `GET /api/v1/instance` llama a `auth.getSession` y **no** a `auth.getUser`;
  - el `Authorization: Bearer <token>` llega a la petición reenviada;
  - una ruta de panel (`/members`) sigue llamando a `getUser` (gate sin cambios).
- [x] Implementar en `proxy.ts`: para `/api/v1`, saltar `getUser()` y reenviar el token con
  `getSession()`; `getSession()` ya refresca cuando el token está vencido (verificado en
  `@supabase/auth-js@2.118.0`, `_loadSession` → `_callRefreshToken`).
- [x] El *door* sigue verificando el JWT con `getUser(jwt)` (sin cambios).
- [ ] Test de refresco explícito: el refresco lo garantiza `getSession`
  (`@supabase/auth-js@2.118.0`, `_loadSession` → `_callRefreshToken`), verificado en el código;
  un test unitario exigiría simular el cliente entero. Se valida en la medición con sesión real.
- [ ] Medir: `/api/v1/instance` antes/después (caliente y frío).

**Verificación:** el test falla si se reintroduce `getUser` en la rama de API.

## Task 4 — L3: `/api/health` barato

- [x] Test: sin `SUPABASE_DB_URL` responde `503 {"status":"degraded"}`; con timeout responde
  `degraded`; con consulta OK responde `200 {"status":"ok"}` (helper inyectable).
- [x] Sustituir `auth.admin.listUsers` por `select 1` con un `Pool` singleton (`max: 1`,
  `connectionTimeoutMillis: 2000`, `idleTimeoutMillis: 10_000`).
- [x] Mantener contrato y `no-store`; sin detalles internos.
- [ ] Medir `/api/health` antes/después.

**Verificación:** el keep-alive sigue en verde y `/api/health` responde `ok` en staging.

## Task 5 — L4: duplicados y cascadas del cliente

- [ ] Captura del propietario (pestaña Red, *Preserve log*) de tres acciones: crear invitación,
  activar módulo, guardar ajustes.
- [ ] Tabla: peticiones esperadas vs observadas, duplicadas y en cascada.
- [ ] Corregir solo lo evitable (doble `refresh`, refetch de datos ya devueltos, efectos
  duplicados que no sean StrictMode).
- [ ] Evidencia antes/después del conteo por acción.

**Verificación:** cada acción reduce peticiones o justifica por qué no.

## Task 6 — L5: cold start

- [ ] Medir inicialización (Runtime Logs `duration_ms` del door vs TTFB) en una ruta de API.
- [ ] Revisar imports pesados en rutas de API (`@scalar/api-reference-react` solo en
  `/docs/api`; Sentry sin arrastrar código innecesario).
- [ ] Aplicar solo lo que la medida justifique; volver a medir el frío.

## Task 7 — L6: consultas

- [ ] Con el baseline, contar consultas por request en listados (invitaciones, miembros,
  módulos) y buscar N+1 reales.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` de las consultas señaladas; índice nuevo solo con
  justificación y migración.

## Task 8 — Cierre

- [ ] `pnpm lint && pnpm tsc && pnpm test` y `pnpm --filter admin build`.
- [ ] Rellenar la tabla «después» en `docs/flows/performance.md` y en la tarea.
- [ ] Actualizar `docs/infrastructure.md` (región) y `docs/flows/cicd.md` si aplica.
- [ ] Revisión con ojos nuevos + auditoría de seguridad (incondicional) antes de `finalizada`.
