---
id: sprint-18-invitation-club
titulo: Invitaciones de club (niveles, cuota y QR)
area: producto
estado: finalizada · mergeada en staging (PR #138)
---

# Sprint 18 — Invitaciones de club

Que la instancia funcione como un club privado: el administrador invita sin límite y cada miembro
puede traer a un número limitado de personas según su nivel. Sin plazas, pide ampliación al
administrador. El acceso se entrega con un QR rotativo o con un enlace compartible.

**Spec:** [`2026-11-18-invitation-club-design.md`](../../superpowers/specs/2026-11-18-invitation-club-design.md)
(aprobada por el propietario el 2026-11-18).
**Plan:** [`2026-11-18-invitation-club.md`](../../superpowers/plans/2026-11-18-invitation-club.md).
**Rama prevista:** `sprint/18-invitation-club` (desde `origin/staging`).
**PR:** uno, draft contra `staging`, desde el primer commit.

## Alcance: once tareas

| # | Tarea | Área |
|---|---|---|
| 00 | Mockups de todas las pantallas (puerta P2) | diseño |
| 01 | Migración, ajustes y modelo base | core + SQL |
| 02 | Cuota viva y nivel del miembro | core |
| 03 | Invitación de miembro, QR e intercambio | core + API |
| 04 | Canje anónimo y herencia | core + web |
| 05 | Solicitudes, concesiones y push | core + API |
| 06 | Panel: niveles, `delegable` y ficha | web |
| 07 | Panel: solicitudes, listado y árbol | web |
| 08 | App: pantalla de invitación | app |
| 09 | App: push y deep links | app |
| 10 | Docs, i18n, OpenAPI y auditoría | docs |

## Ronda de QA manual (2026-11-20/21)

Prueba del propietario en el panel y en un móvil real, concepto a concepto. Lo que salió y cómo
quedó:

| Hallazgo | Arreglo |
|---|---|
| El botón «Crear enlace» no hacía nada | La app mandaba el POST sin cuerpo y el borde exigía `{}`; ahora el cuerpo vacío es válido y la app manda `{}` |
| Una invitación pendiente no se podía reabrir | Modal con el QR del enlace y «Copiar enlace»; al reabrir se **reacuña** el token (`POST /me/invitations/{id}/link`), el anterior deja de valer y la caducidad no se alarga |
| Revocar solo se podía desde la fila | La fila entera abre el modal y la revocación, con confirmación, vive dentro |
| «Caduca en 0 h» en un enlace de 1 h | El cálculo truncaba a horas; ahora horas y minutos (mínimos cuando queda menos de una hora) |
| La caducidad estaba fijada a 48 h | Ajuste `invitations.member_ttl_hours` (1..720) en Ajustes → Invitaciones |
| Aceptar con un email registrado iniciaba sesión sin avisar | Nunca se firma por el invitado: la app y la web dicen que ese correo ya tiene cuenta y piden **su** contraseña; la invitación sigue pendiente |
| Varios 429 al crear tras revocar | Todos los endpoints de usuario compartían un contador; ahora cada ruta sensible tiene su cubeta |
| Un administrador no podía invitar desde la app | Sección de administrador con enlace y QR anónimos (rol `user`, nivel 1, sin gastar plaza); el formulario con email/rol/categoría sigue en el panel |
| Fallos de UI en la app (margen superior, «Activo» duplicado, nivel numérico, badge de niveles, textos de niveles) | Corregidos y con test |

Además, los flujos del club quedaron con puertas automáticas: `pnpm qa:invitations` (API y base de
datos reales), `pnpm qa:web` (navegador real: invitación y panel), `pnpm qa:android` (app en el
emulador) y `pnpm qa:push` (evento y despacho del push). Ver
[`docs/flows/pre-delivery-verification.md`](../../flows/pre-delivery-verification.md).

## Ronda de QA 2 (2026-11-22)

Push real en `staging` con un emulador: token FCM de verdad, sin `google-services.json` (la app
construye `FirebaseOptions` desde los ajustes públicos de la instancia). Hallazgos y arreglos:

| Hallazgo | Arreglo |
|---|---|
| Un build debug en un despliegue protegido por Vercel no registraba token de push | `FcmRegistrar` no enviaba `x-vercel-protection-bypass`; la regla pasa a un helper compartido con `ApiClient` (solo debug y `*.vercel.app`), PR #145 |
| En el diálogo de aprobación no se podía borrar el `0`: al teclear 1 quedaba `01` | Estado de texto (no número) como en los otros editores numéricos, acción deshabilitada mientras no sea 1..100 y e2e que vacía el campo |
| El push solo decía «New invitation request» | El evento lleva `seats` y la app compone «Solicitud de 2 invitaciones» / «Solicitud aprobada · 2 plazas» en 9 idiomas |
| Un email ya registrado dejaba la invitación anónima en un callejón sin salida: la app deshabilitaba el email y la web seguía pidiendo «contraseña actual» aunque se cambiara | El email sigue editable; al editarlo se abandona esa rama, vuelve el formulario de cuenta nueva y la invitación continúa pendiente (web y app) |

Verificado en el emulador contra `staging`: el token se registra, la notificación llega al pedir
plazas y la solicitud aprobada desaparece de la app en ≤5 s por el sondeo.

### Auditoría de seguridad

La ronda la auditó **otro agente** (el DoD pide alguien distinto del autor). Veredicto: **APTO**, sin
hallazgos críticos ni altos, con tres observaciones bajas de defensa en profundidad que se cerraron
en esta misma rama:

| Observación | Arreglo |
|---|---|
| `/join/<code>` renderizaba en servidor sin presupuesto por IP (el endpoint REST sí lo tenía) | Cubeta `join-page:<ip>` (60/min) antes de tocar la base de datos, con test |
| `guard-secrets` no buscaba el prefijo nuevo `027_join_` | Añadido a la expresión del job (y acortado un token ficticio de un test que entonces habría saltado) |
| Faltaban dos invariantes en SQL: `(email is null) = (name is null)` en `invitations` y longitud 1..280 en `invitation_quota_grants.reason` | Migración `0039_invitation_invariants.sql`, verificada con los datos existentes y con `db-tests` de invitaciones en verde |

Lo comprobado y correcto quedó registrado en el informe de la auditoría: autorización por propiedad
en todos los `/me/*` (ajena/usada/caducada → 404 indistinguible), columnas `invite_level`/`invited_by`
fuera del grant de `authenticated`, tokens de 256 bits guardados solo como SHA-256 y devueltos una
vez, QR de un solo uso con bloqueo de fila, cuota y aprobaciones bajo `pg_advisory_xact_lock`,
validación `zod` estricta en todos los bordes, SQL parametrizado, server action con same-origin y
límite propio, push sin nombres ni importes, y scripts de QA con guardia local y limpieza.

### Evidencia de la verificación (2026-11-21)

| Comprobación | Resultado |
|---|---|
| `pnpm lint` | 0 errores (21 avisos previos, `<img>` y un test sin usar) |
| `pnpm tsc` | las 7 áreas en verde |
| `pnpm --filter @027apps/core test` | 46 ficheros / 634 tests |
| `pnpm --filter admin test` | 171 ficheros / 1355 tests |
| `scripts/verify-local.sh` | «All local checks passed» |
| `pnpm qa:invitations` | verde (~50 comprobaciones, API y base de datos reales) |
| `pnpm qa:web` | 7/7 (Chromium real) |
| `pnpm qa:android` | verde (emulador: canje nuevo, email existente, solicitud de plazas) |
| `pnpm qa:push` | verde: eventos encolados y despachados; el push real se verificó a mano en staging con el emulador (token FCM, notificación recibida) |
| `./gradlew :app:testDebugUnitTest :app:assembleDebug` | BUILD SUCCESSFUL |

`db-tests` completo no se ejecuta contra la instancia del propietario (asume una instancia limpia,
ver `docs/flows/pre-delivery-verification.md`); sus suites de invitaciones se cubren con
`pnpm qa:invitations`.

## Fuera de alcance

- Aprobar solicitudes desde la app (solo listarlas; la gestión es en el panel).
- Verificación de email del invitado y notificaciones por email de las invitaciones de miembro.
- Expulsión en cascada y liberación de plazas sin borrar la cuenta.
- Un centro de notificaciones genérico o un cliente realtime nuevo en el panel.

## Criterios de aceptación

- Un miembro con plazas crea un enlace y un QR; el QR caduca a los 90 s y acuña una invitación de
  15 min; el enlace dura 48 h por defecto, configurable en Ajustes → Invitaciones.
- La barra muestra «usadas + reservadas / base + concedidas»; desactivar ocupa, purgar libera y una
  pendiente reserva.
- Sin plazas, la app y el panel ofrecen solicitar; el administrador recibe push, aprueba con una
  cantidad y el solicitante ve la concesión.
- Un miembro no puede elegir rol, nivel, categoría ni módulos; el servidor los deriva.
- El panel muestra el árbol y permite ascender, conceder y retirar; el listado distingue origen y
  anónimas.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build`, `pnpm --filter db-tests test`,
  `pnpm check:openapi`, `pnpm i18n:check` y `:app:testDebugUnitTest` en verde; auditoría de
  seguridad antes de `finalizada`.

## Puertas de usuario

- **P2**: aprobar los mockups de `docs/mockups/invitation-club/` antes de escribir UI (Tasks 6–9).
- Aprobar el plan y el orden de las tareas.
- Aceptar el copy de la pantalla de invitación y de la solicitud en el preview.
- Orden explícita de merge a `staging` y, después, de `staging` a `main`.

## Cierre (2026-11-19)

- Implementación, revisión por tarea y revisión final del branch completadas.
- Auditoría de seguridad: **APTO**; los dos High de fuga del Bearer por deep link a un host ajeno
  están cerrados, y el push de invitación solo lleva `{key, module, seats, state}` (sin nombre ni importe).
- Ramo: `a3a9348..5e38739` (24 commits), rama `sprint/18-invitation-club`.
- Verificación: core 620, admin 1344, i18n 1102 cadenas/9 locales, OpenAPI 121/121, Android 122;
  `db-tests` completo tiene 5 fallos preexistentes por datos de demo locales, y las suites
  objetivo de invitaciones están verdes. CI con base limpia es la referencia.
- Pendiente: orden explícita de merge (PR del sprint contra `staging`) y promoción posterior.

## Relación con el sprint 17

El 17 (panel usable y notificaciones) sigue pendiente y no se sustituye. El 18 toca el mismo panel
y la misma app; si se ejecutan en paralelo, el 17 va primero en los ficheros compartidos
(`apps/admin` y la pantalla de Ajustes de la app).
