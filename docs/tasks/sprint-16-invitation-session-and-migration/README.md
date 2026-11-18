---
id: sprint-16-invitation-session-and-migration
titulo: Invitación app-first, sesión duradera, recuperación y migración de teléfono
area: producto
estado: aprobado (2026-11-16)
---

Sprint **aprobado** por el propietario el 2026-11-16. Toma el número 16 porque el anterior «panel y
notificaciones» nunca llegó a `staging`: vivía en la rama `docs/sprint-16` sin aprobar. Ese plan se conserva
íntegro como **sprint 17** en [`../sprint-17-panel-y-notificaciones/README.md`](../sprint-17-panel-y-notificaciones/README.md)
y su rama original no se borra ni se pisa.

**Spec:** [`2026-11-16-invitation-session-migration-design.md`](../../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
**Plan:** [`2026-11-16-invitation-session-migration.md`](../../superpowers/plans/2026-11-16-invitation-session-migration.md)
**Revisión pre-implementación (seguridad y UX):** [`pre-implementation-review.md`](pre-implementation-review.md)
**Qué queda por revisar:** [`pendientes.md`](pendientes.md) — checklist único de aceptación.

## Por qué este sprint

El propietario probó el alta real y encontró cuatro fallos de producto, no de código: el enlace
del email abre el navegador aunque la app esté instalada (falta el fingerprint en
`assetlinks.json`); la web funciona pero no guía a quien no tiene la app; el logout del panel
cierra también la sesión del móvil; y un miembro desactivado queda atrapado entre `/panel` y
`/login`. Además no hay recuperación de contraseña ni forma de mover la cuenta a un teléfono
nuevo. El sprint cierra esos cuatro frentes con A1–A7.

## Alcance: 12 tareas

| # | Tarea | Tipo | Depende de | Por qué |
|---|---|---|---|---|
| 01 | [Documentación del sprint](task-01.md) | docs | — | Spec, plan y tareas; sin código. |
| 02 | [Mockups](task-02.md) | diseño | 01 | Puerta del DoD de Diseño antes de UI. |
| 03 | [Ciclo de sesión](task-03.md) | feature + bugfix | 01 | Logout local, expulsión limpia, red vs revocado, bucle del panel. |
| 04 | [Contrato de invitación: preview, rol y cuenta existente](task-04.md) | feature | 01 | A2 + A6 + A7 en el contrato antes de construir formularios. |
| 05 | [App Links](task-05.md) | infra | 01, P3 | El enlace debe abrir la app en un dispositivo real. |
| 06 | [Aceptación en la app](task-06.md) | feature | 02, 04, 05 | Precarga, bloqueo, confirmación, auto-login y fallo posterior. |
| 07 | [Wizard web + A1](task-07.md) | feature | 02, 04 | Aviso Android 8+, descarga, reintento sin bucle y canje web. |
| 08 | [Recuperación de contraseña](task-08.md) | feature | 02 | El flujo que hoy no existe, en 9 idiomas y sin enumeración. |
| 09 | [Renovación A3 + cierre A3–A7](task-09.md) | feature | 04, 06, 07 | Renovar caducadas y dejar A4/A5/A6/A7 coherentes. |
| 10 | [Migración por QR](task-10.md) | feature | 02, 03, 05, 06 | Dos móviles reales; el nuevo entra y el viejo queda fuera. |
| 11 | [Cierre](task-11.md) | docs + infra | todas | i18n, flujos, gates, auditorías de seguridad y UX, y verificación real. |
| 12 | [Eliminar una instancia guardada](task-12.md) | app | 03 | Añadida el 2026-11-18: el selector no dejaba quitar una instancia que ya no se usa. |

### Mapa con el orden recomendado del propietario

El propietario propuso 10 bloques. Este sprint añade la **02 (mockups)**, porque el DoD de Diseño
exige un mockup aceptado antes de implementar UI, y adelanta **A2/A6/A7** a la 04 para que los
formularios de la 06/07 no se construyan dos veces. La 09 conserva A3 y el cierre de coherencia
A3–A7. El resto del orden se mantiene.

| Bloque del propietario | Tarea |
|---|---|
| 1. Scaffolding + spec + plan + tareas | 01 |
| (nuevo) Mockups | 02 |
| 2. Ciclo de sesión | 03 |
| 3. Vista previa A2 | 04 |
| 4. App Links | 05 |
| 5. Aceptación en app | 06 |
| 6. Wizard web + aviso + A1 | 07 |
| 7. Recuperación | 08 |
| 8. A3–A7 | 04 (A2/A6/A7) + 09 (A3 + cierre) |
| 9. Migración QR | 10 |
| 10. Cierre | 11 |

## Requisitos cerrados por el propietario

1. **Aceptación app-first**: el enlace abre la app si el App Link está verificado; formulario con
   email, nombre, instancia, invitador y caducidad bloqueados, solo contraseña y confirmación; al
   enviar crea la cuenta e inicia sesión.
2. **Sin app**: wizard con aviso «por ahora solo existe la app Android (8+)», descarga del APK,
   reintento sin bucle y canje web; en escritorio, QR/instrucciones además del canje.
3. **Sesión**: solo termina por logout o expulsión; no por reinicio, actualización, modo avión,
   error de red ni logout en otro dispositivo.
4. **Recuperación de contraseña**: entra en este sprint.
5. **Migración de teléfono**: QR en el viejo, escaneo en el nuevo, entra solo; solo Android y se
   advierte.
6. **A2–A7**, además de A1 si el propietario lo mantiene.

## Decisiones aprobadas

La spec §4.2 tiene la tabla completa; D1–D20 se aprobaron el 2026-11-16. **D21 se resolvió como
sesión primero** (la app y la web firman antes de canjear; el Core no verifica contraseñas). Las
que más cambian el producto:

| # | Decisión | Propuesta |
|---|---|---|
| D1 | Mapa de tareas | 11 tareas (con mockups); A2/A6/A7 en la 04. |
| D2 | A1 auto-login web | Sí para roles de panel; `user` va a `/welcome`. |
| D3 | Recuperación | Email propio Resend 9 idiomas + `generateLink` + `verifyOtp`; sin redirect URLs de Supabase. |
| D4 | Escáner del QR | Dentro de la app (ZXing/CameraX); la cámara del sistema también vale. |
| D5 | Contenido del QR | URL App Link `https://<instancia>/migrate/<token>`. |
| D6 | Rol de cuenta existente | No cambia al canjear; el panel lo cambia aparte. |
| D7 | Localizar `/login` | Sí, en este sprint. |
| D8 | Sesión tras reset | Cerrar y volver al login con aviso. |
| D9 | Confirmación en el viejo | Automática. |
| D10 | Renovación | Duración original guardada en la fila. |
| D16 | Email de cuenta existente | Segunda variante de copy. |
| D20 | APK de prueba | Release firmada del sprint. |

## Fuera de alcance

- App iOS, Play Store, actualización automática y push en iOS.
- Registro abierto, login social, MFA, passkeys y cambio de email.
- Un selector de logo de instancia; se usa el wordmark/icono + `instance.name`.
- Un panel de sesiones por dispositivo; la expulsión se hace por la ficha del miembro y por
  desactivación/borrado.
- Rehacer el runtime de módulos o el contrato del manifest.
- Migración de teléfono en web o iOS.

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El App Link no verifica en el dispositivo | El requisito app-first no se ve | P3, `pm get-app-links`, verificar el certificado del APK antes; el esquema propio y la web siguen. |
| El logout global sigue en algún sitio | El móvil pierde la sesión | Scope explícito y test; búsqueda de `signOut(` en revisión. |
| El refresh de red se confunde con revocación | Se pierde la sesión en modo avión | Tres resultados (`Refreshed`/`NoSession`/`Network`) y tests. |
| El bucle del panel no se cierra | Un expulsado no vuelve a entrar | `/logout` + guard de tres casos + tests. |
| El reset filtra si un email existe | Enumeración | Respuesta y UI idénticas, límites IP/email, sin logs. |
| El QR se filtra | Sesión de otro | 60 s, single-use, hash, `FLAG_SECURE`, rate limit, magic link de un solo uso. |
| El rol admin se cuela | Escalada | Guard en el servicio, no solo en la UI; tests de sesión/service/delegated. |
| La renovación invalida un enlace en uso | Fricción | Confirmación en el panel; el token nuevo se muestra una vez. |
| Supabase tiene «Time-box» o «Inactivity timeout» | La sesión caduca por política aunque el código esté bien | P10 confirmado (off por defecto); si se activa, se documenta como excepción y la prueba de sesión lo detecta. |
| La app ya tiene sesión de otra instancia | El enlace podría reutilizarla o mezclar la sesión | Crear el cliente de la instancia del enlace; no cambiar en silencio; cerrar/limpiar la anterior (S9). |
| El sprint se alarga | Aceptación tardía | Aceptación por tarea; el 17 se preserva; gates P2–P5/P10. |

## Puertas del propietario

1. **Aprobar esta spec y el plan** (P1), incluidas D1–D20 — hecho 2026-11-16; D21 resuelto como
   sesión primero.
2. **Aprobar los mockups** de app, wizard, QR y reset (P2) — **aprobado 2026-11-16** tras la
   corrección de la entrada al escáner del móvil nuevo.
3. **Poner `ANDROID_APP_SHA256`** en Vercel Production (y Preview si se prueba) y redesplegar (P3).
4. **Facilitar un Android real** para App Links y **dos** para el QR (P4).
5. **Confirmar la recuperación** y las credenciales de Resend en producción (P5).
6. **Confirmar en Supabase Auth** que «Time-box user sessions» e «Inactivity timeout» están
   desactivados, o el valor que quiera (P10) — confirmado 2026-11-16: no se activaron; valores por
   defecto off. La prueba real de sesión lo valida.
7. **Leer el resumen de las auditorías finales** de seguridad y UX (P9).
8. **Dar la orden explícita de merge** del sprint 16 y del 17 (P7) y de promoción (P8).

## Reglas del sprint

- Un PR por sprint, draft contra `staging` desde el arranque; no se mergea sin orden.
- Spec → mockup aprobado → TDD → revisión → auditoría de seguridad. Nada de UI antes de P2.
- `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build`; si toca
  Core/BD, `pnpm --filter db-tests test`; si toca Android, tests + `assembleDebug`.
- **Dos auditorías finales** antes de `finalizada`, por agentes distintos del implementador:
  **seguridad** (OWASP A01–A11, incluido Android) y **UX** (flujos, estados, copy 9 idiomas,
  contraste, 375/390 px, teclado y lector de pantalla, QR, reset, bienvenida y migración). Informes
  escritos y resumen para el propietario (P9).
- Nada se anuncia sin la verificación de `docs/flows/pre-delivery-verification.md` y su salida
  pegada.
- La revisión pre-implementación está en `pre-implementation-review.md`; **D21** (verificación de la
  contraseña existente) está resuelto como **sesión primero** desde el 2026-11-16.
- **P10**: confirmado por el propietario (2026-11-16): «Time-box user sessions» e «Inactivity
  timeout» no se activaron; valores por defecto off. La prueba real de sesión de la tarea 11 lo
  valida.
- El plan anterior (panel y notificaciones) queda como sprint 17, sin tocar su contenido; su rama
  `docs/sprint-16` no se borra.
