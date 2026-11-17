# Sprint 16 — auditorías de seguridad y de UX

Dos agentes distintos del autor revisaron el sprint completo: uno de seguridad (OWASP A01–A11,
incluida A11 Android) y otro de UX/accesibilidad. Este fichero recoge sus hallazgos y qué se hizo
con cada uno. La tarea no pasa a `finalizada` con un crítico o un alto abierto sin motivo escrito.

## Seguridad

| # | Severidad | Hallazgo | Resolución |
|---|---|---|---|
| 1 | Alta | Un enlace `/migrate` abierto en frío (`_state` en `Loading`) borraba la sesión guardada, y podía cambiar de instancia en silencio hacia un servidor del atacante | Corregido: `onMigrationLink`/`acceptMigration` miran también la sesión **en disco**; un enlace con otra instancia pide confirmación con el host antes de canjear |
| 2 | Alta | El móvil viejo no cerraba su sesión al ver `used`; al salir del QR volvía al panel con el token vivo hasta 15 min | Corregido: `watchMigration` llama a `endSession(revoked = true)` cuando el estado es `used` |
| 3 | Alta | Rate limit por IP evadible con `X-Forwarded-For`; sin el límite de 5 intentos por token en `exchange`; y el polling del QR consumía el presupuesto que necesitaba la renovación (429 en bucle) | Corregido: helper `clientIp` con la precedencia de `door.ts` en las tres superficies, límite por hash de token en `exchange` y `bucket` propio por ruta en el door |
| 4 | Alta | Carrera en el canje: dos peticiones simultáneas podían borrar la cuenta que la otra acababa de crear, dejando la invitación consumida | Corregido: el adaptador ya no devuelve un usuario existente al llamante anónimo (`existing_account_signin_required`) y no se borra el usuario cuando el fallo es `invitation_used`. Test de concurrencia ampliado: la cuenta sobrevive |
| 5 | Alta | Si el móvil nuevo no registraba push, el viejo seguía recibiéndolo; y el logout usaba un JWT de más de 15 min | Corregido: `keep_device_id: null` revoca todos los dispositivos y el cliente lo envía siempre; `FcmRegistrar.revoke` recibe el token vivo |
| 6 | Media | `/migrate/` no estaba en el manifest de release: el QR abría el navegador y dejaba el token en su historial | Corregido: segundo `pathPrefix` en el `intent-filter` verificado (tarea 05) |
| 7 | Media | `ApiClient` redactaba UUIDs pero no los tokens `027_inv_`/`027_mig_`: un error HTTP los escribía en Logcat | Corregido con `redactPath` + test (`ApiPathRedactionTest`) |
| 8 | Media | `Referrer-Policy` global pisaba el `no-referrer` de `/migrate`, `/auth/confirm`, `/forgot-password` y `/reset-password`; faltaba `X-Robots-Tag` | Corregido en `next.config.ts` |
| 9 | Media | Un enlace de recuperación seguía creando sesión para una cuenta desactivada después de emitirse | Corregido: `isActiveProfile` en confirmar, página y acción de reset; cierra la sesión local y vuelve al aviso genérico. Test añadido |
| 10 | Media | `/migrate/[token]` construía la instancia desde `Host`/`X-Forwarded-Proto` y validaba el token con un prefijo | Corregido: `instance.public_url` y el patrón completo del token |
| 11 | Baja | El widget conservaba saldos tras un 401 en segundo plano | Corregido: un 401 limpia la sesión y el snapshot |
| 12 | Baja | Faltaba test de RLS de `device_transfers` y `guard-secrets` no cubría los tokens del sprint | Corregido: `packages/db-tests/src/rls/device-transfers.test.ts` y dos prefijos más en CI |

Sin hallazgos (a preservar): canje «sesión primero» que nunca verifica contraseñas ajenas, doble
barrera del rol (CHECK + Zod + servicio), recuperación sin oráculo de cuentas y con suelo de 700 ms,
`GET /auth/confirm` que no gasta el token, hash único de los códigos, `FOR UPDATE`, `FLAG_SECURE`,
`allowBackup=false` y `signOut(OTHERS)` en el cliente.

## UX y accesibilidad

| # | Severidad | Hallazgo | Resolución |
|---|---|---|---|
| A1 | Alta | La ficha de la invitación se pintaba dos veces y había tres «Sign in» en el mismo formulario | Corregido: la ficha vive solo en el asistente y queda un enlace de entrada por pantalla. Test de «una sola ficha» |
| A2 | Alta | Renovar refrescaba la página y borraba el único enlace nuevo | Corregido: no se refresca hasta que el admin pulsa «Done» |
| A3 | Alta | La app no ofrecía reintento si fallaba la carga de la invitación | Corregido: «Reintentar» en esa rama (`retryInvitePreview`) |
| A4 | Alta | Un QR caducado seguía en pantalla con «Caduca en 0 s» | Corregido: rama `expired` con su mensaje y botón; el escáner muestra la instancia |
| M1 | Media | El texto del QR estaba escrito desde el móvil nuevo | Corregido: copia propia del QR y otra para la fila de Ajustes |
| M2 | Media | La renovación automática ocultaba el código válido mientras pedía otro | Corregido: se conserva el QR y solo se muestra un progreso discreto |
| M3 | Media | Con la cámara denegada no había salida | Corregido: «Reintentar» y «Abrir ajustes» |
| M4 | Media | El diálogo «cierra sesión primero» no dejaba hacerlo | Corregido: «Cerrar sesión y escanear» canjea el enlace tras cerrar |
| M5 | Media | El aviso de cuenta creada salía en rojo de error | Corregido: verde de acento; rojo solo para la revocación |
| M6 | Media | «Signing in…» fijo en inglés en los nueve idiomas | Corregido: etiqueta pendiente traducida |
| M8 | Media | Campos a 14 px: iOS hacía zoom al enfocar | Corregido: 16 px en móvil, 14 px desde `sm` |
| M9 | Media | QR de escritorio con 2 módulos de margen sobre superficie oscura | Corregido: `margin: 4` y sin fondo de tarjeta |
| M10 | Media | `/migrate` no avisaba de que es solo Android ni de los 60 s | Corregido con el aviso y la caducidad |
| M13 | Media | Los fallos de migración decían «No pudimos aceptar la invitación» | Corregido: mensajes propios de crear código y de mover cuenta |
| M15 | Media | Los formularios de recuperación no tenían estado pendiente | Corregido: botón con `useFormStatus` y etiqueta traducida en los tres |
| M16 | Media | Un fallo de red al aceptar dejaba el botón en «Accepting…» | Corregido: `try/catch` con reintento |
| B1 | Baja | Fuga de español en gallego | Corregido: «Volver ao inicio de sesión» y «co teu contrasinal» |
| B5 | Baja | `FLAG_SECURE` no se explicaba | Corregido: nota al pie del QR |

### Diferido, con motivo

| Hallazgo | Motivo |
|---|---|
| M7 (caducidad sin hora ni zona) | Cambia el formato en web, app y email, con textos localizados nuevos y tests de formato por zona. Va en su propia tarea para no mezclarlo con el cierre |
| M11 (503 en texto plano del proxy) | Requiere una página de error con marca y nueve idiomas; hoy no es un camino del sprint y el proxy ya devuelve `Retry-After` |
| M14 (admin que cae en la bienvenida de miembro si falla el login automático) | Caso raro que necesita decidir el copy de `/welcome` por rol; se anota para el sprint de perfil |
| B2, B3, B4, B6–B12 | Pulido (copy, áreas táctiles de enlaces, semántica del QR, iconografía menor). Nada impide aceptar ni migrar; se recogen para la revisión visual con el propietario |

## Evidencia

- `pnpm lint` (0 errores), `pnpm tsc`, `pnpm i18n:check` (1030 cadenas, 9 idiomas),
  `pnpm check:openapi` (106/106), `pnpm --filter admin build`.
- Tests: `core` 532, `admin` 1235, `i18n` 26, `owe-no` 26; Android 87.
- `db-tests` de los ficheros tocados (invitaciones, dispositivos, RLS) contra la base local.
- `scripts/verify-local.sh` contra la instancia local: todo en verde, incluidas las páginas públicas.
