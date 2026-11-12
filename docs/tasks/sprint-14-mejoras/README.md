---
id: sprint-14-mejoras
titulo: Invitaciones por email, rendimiento, landing y deuda de infraestructura
area: producto
estado: finalizado
---

Sprint **definido el 2026-11-10**, pendiente de que el propietario apruebe las specs. Tres
frentes de producto con spec propia y uno de deuda de infraestructura que va como tarea
`infra` con evidencia.

Orden propuesto de ejecución (se puede reordenar por decisión del propietario):

| Orden | Tarea | Tipo | Por qué en esta posición |
|---|---|---|---|
| 1 | [task-01](task-01.md) — Rendimiento medido | refactor + infra | Fija el método de medida y corrige la región/dobles llamadas antes de que nada más se mida. |
| 2 | [task-02](task-02.md) — Dependabot a `staging` | infra | Es pequeña, evita rebases sobre una rama que crece y no depende de credenciales. |
| 3 | [task-03](task-03.md) — Invitaciones por email | feature + diseño | Fase de mockups + credencial de Resend; el diseño se cierra antes de implementar. |
| 4 | [task-04](task-04.md) — Landing pública | feature + diseño | Necesita las referencias del propietario y se beneficia del trabajo de rendimiento. |
| 5 | [task-05](task-05.md) — Apariencia por usuario | feature | Tema e idioma en el perfil; la cookie pasa a ser solo una pista de carga. |

## Decisiones del propietario (2026-11-10)

- **Email de invitación:** idioma elegible en el alta; 3 direcciones de mockup con la marca
  actual, HTML + PNG, iterando hasta aprobación; plantilla reutilizable; incluye logo, quién
  invita, caducidad y aviso de seguridad. La entrega se elige en el alta (*email* o *solo
  enlace*); si el envío falla, la invitación se crea igual y se ofrece el enlace; se puede
  reenviar.
- **Rendimiento:** objetivo intermedio (p95 API ≤ 400 ms caliente / ≤ 1,2 s frío), medido
  antes y después, incluyendo páginas. Se auditan **llamadas duplicadas y cascadas** porque el
  propietario nota lentitud al actuar.
- **Landing:** `/` es siempre la landing y el panel se mueve a `/panel`; 9 idiomas; contenido
  con descarga Android, GitHub, lista de módulos y capturas; referencias visuales antes del
  mockup; documentación para agentes sobre cuándo actualizarla.

## Candidatas de producto

| # | Tema | Estado | Spec |
|---|---|---|---|
| 1 | **Envío de invitaciones por email** (Resend) | Spec propuesta | [2026-11-10-invitation-email-design.md](../../superpowers/specs/2026-11-10-invitation-email-design.md) |
| 2 | **Rendimiento de las llamadas a la API** | Spec propuesta | [2026-11-10-api-performance-design.md](../../superpowers/specs/2026-11-10-api-performance-design.md) |
| 3 | **Landing page pública** | Spec propuesta | [2026-11-10-public-landing-design.md](../../superpowers/specs/2026-11-10-public-landing-design.md) |

## Deuda de infraestructura (bloqueada o fuera de alcance)

| # | Tema | Estado | Notas |
|---|---|---|---|
| 4 | **FCM / notificaciones push** | Bloqueado | Necesita proyecto Firebase y `google-services.json`. No se toca hasta que el propietario lo entregue. |
| 5 | **Copia secundaria de backups (3-2-1)** | Bloqueado | Necesita un segundo bucket en otro proveedor. `docs/infrastructure.md` §8. |
| 6 | **Backup de ficheros de Storage** | Condicionado | Hoy no hay buckets en uso; se diseña cuando el producto empiece a subir ficheros. |

## Dependabot

Corregido el diagnóstico del cierre del sprint 13:

- `#38` (gradle) está **cerrado**; lo sustituye **#51**.
- **#33** (eslint 10) sigue en `staging` y con conflictos; **#39** (actions) en `staging` y
  limpio.
- **#34** (@types/node 26) cambió su base a `main`; hay nuevos **#52** (grupo npm) y **#14**
  (TypeScript 7), también contra `main`.
- Causa raíz: `.github/dependabot.yml` no declara `target-branch`, así que Dependabot usa la
  rama por defecto (`main`). `task-02` lo corrige y tria los PRs. **Ningún PR se mergea sin
  orden explícita.**
- **Ejecutado (2026-11-10)**: `target-branch: staging` en los tres ecosistemas y los PRs #34,
  #51, #52 y #14 retargeteados. Rebase pedido en #33 y #14. La config surte efecto cuando
  llegue a `main`.

## Cierre (2026-11-12)

Sprint **finalizado** y desplegado en producción (`b6b8b51`, PR #89). `staging` y `main` quedan
sincronizadas (`54f7606`).

| Tarea | Resultado |
|---|---|
| 01 — Rendimiento | Región `lhr1`, una sola verificación de JWT y health barato; medición antes/después. |
| 02 — Dependabot | `target-branch: staging` en los tres ecosistemas; triaje hecho sin mergear. |
| 03 — Invitaciones por email | Resend, elección email/enlace, reenvío, rotación y plantilla en 9 idiomas. |
| 04 — Landing pública | `/` y `/self-host`, panel en `/panel`, idioma por cookie, cookies y SEO. |
| 05 — Apariencia | Tema e idioma persistidos en el perfil, cookie solo como pista de carga. |

**Dependabot:** #52 (Next 16.4.5, Sentry, Supabase, Tailwind, Vitest), #39 (actions) y #51
(Gradle/Firebase/Android) rebasados para revisión; #33 (ESLint 10) queda para una migración
dedicada; #14 (TypeScript 7) y #34 (`@types/node` 26) cerrados por desajuste con el toolchain y
el runtime.

**Fuera del sprint, pendiente:** FCM, backup 3-2-1 y Storage siguen bloqueados por credenciales
o buckets; las capturas reales de panel/app esperan a que existan pantallas de la app. La
revisión nativa de traducciones la descarta el propietario.

## Reglas

- Cada punto necesita spec aprobada antes de implementar (`AGENTS.md`); la deuda de
  infraestructura que solo es configuración o credenciales va como tarea `chore`/`infra` con su
  evidencia.
- Un PR por sprint, en draft contra `staging` desde el arranque.
- Nada de FCM, 3-2-1 ni Storage hasta que el propietario dé credenciales o haya buckets.
