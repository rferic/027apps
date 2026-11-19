---
id: sprint-18-invitation-club
titulo: Invitaciones de club (niveles, cuota y QR)
area: producto
estado: en curso
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

## Fuera de alcance

- Aprobar solicitudes desde la app (solo listarlas; la gestión es en el panel).
- Verificación de email del invitado y notificaciones por email de las invitaciones de miembro.
- Expulsión en cascada y liberación de plazas sin borrar la cuenta.
- Un centro de notificaciones genérico o un cliente realtime nuevo en el panel.

## Criterios de aceptación

- Un miembro con plazas crea un enlace y un QR; el QR caduca a los 90 s y acuña una invitación de
  15 min; el enlace dura 48 h.
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

## Relación con el sprint 17

El 17 (panel usable y notificaciones) sigue pendiente y no se sustituye. El 18 toca el mismo panel
y la misma app; si se ejecutan en paralelo, el 17 va primero en los ficheros compartidos
(`apps/admin` y la pantalla de Ajustes de la app).
