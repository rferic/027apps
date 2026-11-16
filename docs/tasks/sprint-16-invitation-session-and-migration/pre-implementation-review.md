# Revisión pre-implementación — seguridad y UX

**Fecha:** 2026-11-16 · **Estado:** Revisión del planteamiento, no del código.
**Spec:** [`2026-11-16-invitation-session-migration-design.md`](../../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
**Plan:** [`2026-11-16-invitation-session-migration.md`](../../superpowers/plans/2026-11-16-invitation-session-migration.md)

Esta revisión la hace el orquestador antes de escribir código. **No sustituye a las auditorías
finales**: la de seguridad y la de UX las harán agentes distintos del implementador al cerrar el
sprint (tarea 11).

## Veredicto

El planteamiento es sólido: separa bien los tres planos (invitación, sesión y migración), el
contrato de API es explícito, el modelo de datos es aditivo y las puertas de usuario están claras.
No hay ningún bloqueo arquitectónico. Hay **una decisión material** que recomiendo cambiar antes de
implementar (S1: verificación de la contraseña existente en el servidor) y varios ajustes de
seguridad/UX que ya he incorporado al plan: la confirmación del enlace de reset, el tiempo de
respuesta de la recuperación, el QR que se autoregenera, el idioma de la invitación y la
presentación de los campos bloqueados.

**Recomendación:** aprobar S1 (sesión primero) y empezar por los mockups. **Resuelto el
2026-11-16: se implementa sesión primero.** La alternativa de 5 intentos por token queda descartada.

## Método

- Lectura del código real de los cuatro caminos que toca el sprint: canje (`packages/core/src/
  invitations/`), sesión web (`panel-guard`, `instance-gate`, `proxy`, `actions`), sesión Android
  (`ApiClient`, `AppViewModel`, `FcmRegistrar`) y dispositivos (`devices/service.ts`).
- Modelo de amenaza del token de invitación, del QR, del enlace de reset y de la sesión.
- Recorrido de los flujos de la spec §7 y de los estados de §8 como si fuera el propietario en un
  Android de 390 px y en un navegador de escritorio.
- No se ha ejecutado código nuevo; los hallazgos son de diseño y de contrato.

## Seguridad

| ID | Severidad | Hallazgo | Recomendación | Estado |
|---|---|---|---|---|
| S1 | **Alta** | `verifyPassword` hace `signInWithPassword` con la anon key **desde el servidor** para verificar la contraseña de una cuenta existente. El token de invitación vive 7 días y no se consume con un intento fallido: un token filtrado es un oráculo de contraseñas (30/min por IP, muchas IPs posibles). Además, todos los intentos comparten la IP del servidor y el límite de Supabase por IP. | **Sesión primero**: la app inicia sesión con Supabase Auth (IP del usuario) y luego canjea con el Bearer; la web firma primero con el cliente SSR y canjea con la sesión. El Core comprueba que el `userId` de la sesión es el de la invitación; no verifica contraseñas. Alternativa: 5 intentos fallidos por token y bloqueo temporal. | **Resuelto: sesión primero (2026-11-16)** |
| S2 | **Media** | El enlace del email de reset apunta a un `GET /auth/confirm` que consume el `token_hash` al cargar. Los escáneres de enlaces de los clientes de correo (Outlook Safe Links, antivirus) prefetchean y pueden invalidar el enlace antes de que la persona lo abra. | Convertir `/auth/confirm` en una página con un botón «Continuar» que verifica en `POST` (server action). El `GET` solo pinta; el token no se consume hasta la acción. | **Aplicado a la spec/plan/tarea 08** |
| S3 | **Media** | La recuperación responde distinto en tiempo si el email existe (genera enlace + Resend) o no (respuesta inmediata). Es una vía de enumeración por temporización aunque el cuerpo sea idéntico. | Suelo de respuesta común (≈700 ms) en ambos caminos, con un puerto de espera inyectable para el test, además de los límites por IP/email. | **Aplicado** |
| S4 | **Baja/Media** | La revocación de un dispositivo borra `auth.sessions`, pero el access JWT sigue válido hasta 15 min. La desactivación y el borrado sí son inmediatos porque el door comprueba el perfil. | Documentar el límite; la migración fuerza refresco al arrancar y el viejo borra al ver `used`. Si se exige revocación inmediata de sesión, haría falta una época de sesión por usuario (fuera de alcance). | **Documentado en la spec §9.2/§11.5** |
| S5 | **Baja** | El QR es bearer: una foto del QR puede competir con el móvil nuevo; el TTL de 60 s y el single-use lo acotan, pero el `FLAG_SECURE` no impide una cámara externa. | Mantener 60 s, single-use, hash y rate limit; autoregenerar mientras la pantalla está abierta (UX) sin alargar el TTL; el escáner propio evita que la URL pase por Lens. | **Aplicado (auto-renew)** |
| S6 | **Baja** | El QR como `<img src="data:image/png…">` puede chocar con la CSP (`img-src`); y un QR sobre fondo oscuro no se escanea. | SVG inline (o ruta same-origin), tarjeta blanca con quiet zone en claro y oscuro; no ampliar la CSP. | **Aplicado a 02/07/10** |
| S7 | **Baja** | Forzar un refresco en cada arranque de la app cierra la ventana de 15 min del móvil viejo, pero añade una rotación de refresh token al inicio; un cierre a mitad podría perder la sesión (la excepción del Keystore). | Mantener el refresco al arrancar por la garantía de la migración y documentar la rotación como riesgo residual raro; el cliente ya guarda la sesión cifrada inmediatamente. | **Documentado; sin cambio** |
| S8 | **Baja** | El logout del móvil también borraba todas las sesiones (`DELETE /devices/{id}` → `delete from auth.sessions`). | Ya corregido en la tarea 03 con `sessions=local` para el dueño y `all` para el panel. | **Aplicado** |
| S9 | **Baja** | Si la app ya tiene sesión de **otra** instancia, el enlace de invitación podría reutilizarla o mezclar la sesión. | Crear el cliente Supabase de la instancia del enlace; no cambiar de instancia en silencio; cerrar/limpiar la anterior si se cambia. | **Aplicado a 06** |

### S1 en detalle (decisión resuelta: sesión primero)

La spec actual (§6.4) hace que el Core verifique la contraseña existente. Es lo más simple, pero
convierte el token de invitación en un oráculo de contraseñas y hace que todos los intentos salgan
de la IP del servidor. La alternativa que recomiendo:

1. El preview sigue diciendo `account_exists`.
2. **App**: si existe, la persona escribe su contraseña actual; la app hace
   `supabase.auth.signInWithPassword` (cliente, IP del usuario). Si falla, no se llama al canje y la
   invitación sigue pendiente. Si funciona, llama a `POST /invitations/{token}/redeem` con el
   Bearer; el Core exige que el `userId` de la sesión sea el de la cuenta invitada y materializa
   categoría/módulos.
3. **Web**: la server action firma primero con el cliente SSR (como hace `/login`), canjea con la
   sesión y decide A1. Para una cuenta nueva: canje con contraseña y luego login.
4. El Core deja de necesitar `verifyPassword`; el puerto de Auth se queda con
   `findUserByEmail`, `createUser` y `deleteUser`.
5. Si no hay sesión para una cuenta existente: `409 existing_account_signin_required`; el cliente
   firma y reintenta. Es un estado más, no un error genérico.

**Coste:** una rama más en la app y en la action, y un cambio en el contrato de redeem. **Beneficio:**
desaparece el oráculo, el canje de una cuenta existente no verifica contraseñas en el servidor y la
app inicia sesión una sola vez (mejor UX). **Aprobado 2026-11-16.** La alternativa de 5 intentos por
token no se implementa.

### Modelo de sesión (aclaración)

La intuición del propietario es correcta: la app obtiene una credencial durable y la usa para ir
renovando el acceso, pero no es una «firma» propia, es la sesión de Supabase Auth:

- **Access token**: dura 15 minutos y es lo que la app envía en cada llamada a `/api/v1`. Caducar no
  cierra la sesión; solo obliga a renovar.
- **Refresh token**: es la credencial durable. La app lo guarda **cifrado con el Keystore**
  (`EncryptedSessionManager` + `EncryptedStringStore`), nunca en claro y nunca la contraseña. Lo
  envía solo a Supabase Auth por HTTPS y recibe un access token nuevo y un refresh token **rotado**
  (rotación activa, reutilización 10 s); guarda el nuevo.
- **Duración**: mientras el refresh token siga siendo válido, la app entra sin pedir la contraseña
  aunque pasen días o semanas sin usarla. No se cierra por reinicio, actualización, modo avión ni
  error de red; si no hay red, conserva la sesión y reintenta.
- **Fin**: logout local, expulsión (desactivación, borrado, revocación) o que el refresh token deje
  de ser válido. **P10**: si el proyecto Supabase tiene «Time-box user sessions» o «Inactivity
  timeout» activos, la sesión terminará por esa política aunque el código esté bien; hay que
  confirmarlo en el dashboard (el `config.toml` local solo fija `jwt_expiry=900`, rotación y
  reutilización 10 s).
- **Excepciones**: perder la clave del Keystore (reinstalar/restaurar), una expulsión, una política
  de Supabase activa o una interrupción justo durante la rotación (ventana de 10 s, riesgo residual
  raro). La migración por QR existe para el caso de cambiar de teléfono sin perder la cuenta.

## UX

| ID | Severidad | Hallazgo | Recomendación | Estado |
|---|---|---|---|---|
| U1 | **Alta** | Un QR de 60 s es muy justo para el primer uso: desbloquear el móvil nuevo, abrir la app, dar permiso de cámara y escanear. Es fácil que caduque y que la persona lo perciba como un fallo. | Mantener 60 s por código, pero **autoregenerar** el QR mientras la pantalla del viejo está abierta (a los ~45 s), con cuenta atrás y aviso «código actualizado». El código anterior sigue válido hasta su TTL. | **Aplicado a 10** |
| U2 | **Media** | La cuenta existente pide la contraseña actual y no ofrece recuperación; si no la recuerda, el flujo es un callejón. | Enlace «¿Olvidaste tu contraseña?» junto al campo, en app (abre la web) y en web; tras el reset se vuelve al enlace de invitación, que sigue pendiente. | **Aplicado a 06/07/08** |
| U3 | **Media** | La página de invitación usa el idioma de la cookie del navegador, no el de la invitación; el email puede estar en español y la web en inglés. | La página usa el `locale` del preview (el de la invitación) con la cookie como fallback; la app usa el mismo `locale` en el formulario. | **Aplicado a 06/07** |
| U4 | **Media** | Campos «bloqueados» como inputs deshabilitados parecen un formulario roto y no se pueden copiar bien. | Mostrar los datos como una ficha (label + valor) y dejar como únicos inputs las contraseñas. El email/nombre se pueden copiar. | **Aplicado a 02/06/07** |
| U5 | **Media** | El QR sobre fondo oscuro o con poco silencio no se escanea; en escritorio puede quedar pequeño. | Tarjeta blanca con quiet zone, tamaño generoso y prueba real con la cámara; en la app lo mismo. | **Aplicado a 02/07/10** |
| U6 | **Baja** | «Abrir en la app» puede no hacer nada o mostrar un error del navegador si el esquema no está registrado; el usuario no sabe si esperar. | Copy «Si no se abre, usa una de las opciones de abajo», timeout de 1,5 s y fallback siempre visible; nunca redirigir solo al cargar. | **Aplicado a 07** |
| U7 | **Baja** | El éxito web de un `user` no tiene panel; si aterriza en `/login` puede pensar que el alta falló. | `/welcome` dice «Cuenta creada», ofrece descargar la app y un enlace a login; el admin va a `/panel`. | **Aplicado a 07** |
| U8 | **Baja** | Los errores de contraseña existente, caducada, usada y rate limit pueden caer en un texto genérico. | Copy específico y accionable: «Esa no es la contraseña de esta cuenta», «Caducó; pide una nueva a {invitador}», «Ya se aceptó; inicia sesión», «Demasiados intentos; espera un minuto». | **Aplicado a 06/07** |
| U9 | **Baja** | En la migración, el móvil viejo no muestra qué cuenta se está moviendo; el nuevo solo ve la instancia del QR hasta que canjea. | El viejo muestra email + instancia; el nuevo muestra la instancia del QR antes de escanear y el email en el estado de éxito (el canje ya es una acción explícita; no se añade un paso que consuma el código antes de tiempo). | **Aplicado a 10** |
| U10 | **Baja** | La pantalla de sesión sin conexión puede parecer un error de sesión. | «Sin conexión. Tu sesión sigue guardada.» + Reintentar; no borrar ni pedir login. | **Aplicado a 03** |

## Cambios aplicados a los documentos

- **Reset**: `/auth/confirm` pasa a página con botón y verificación en `POST` (S2); suelo de
  respuesta de ~700 ms (S3); `next` sigue en allowlist. Tarea 08 y plan 08.2 actualizados.
- **QR**: autoregeneración mientras la pantalla está abierta (U1); tarjeta blanca y SVG inline
  (S6/U5); email + instancia visibles (U9). Tareas 02, 07 y 10 actualizadas.
- **Idioma**: la página de invitación y la app usan el `locale` del preview (U3).
- **Formulario**: datos de la invitación como ficha, no inputs deshabilitados (U4); «¿Olvidaste tu
  contraseña?» para cuentas existentes (U2); copy de errores (U8).
- **Sesión**: D21 sesión primero (S1) en §6.4, §7.1, §7.3, §7.4 y tareas 04/06/07; modelo de
  refresh token durable explicado en §7.8; P10 (time-box/inactivity de Supabase) añadido a las
  puertas; nota del límite de 15 min para revocación de dispositivo/sesión (S4); la app fuerza
  refresco al arrancar y el viejo borra al ver `used` (S7); offline con «sesión segura» (U10);
  la invitación no reutiliza una sesión de otra instancia (S9).
- **Auditorías finales**: la tarea 11 añade una **auditoría de UX experta** además de la de
  seguridad; ambas por agentes distintos del implementador, con informe escrito. La spec §11.5 y
  §13, el plan y el README del sprint se actualizan.

## Lo que no cambia

- La web sigue siendo una vía completa de canje; el wizard no es una puerta.
- El QR sigue siendo de 60 s, un solo uso y hash; no lleva refresh token ni contraseña.
- El rol de una cuenta existente no cambia al canjear.
- La recuperación no revela si un email existe y no usa las plantillas de Supabase.
- El logout del panel y el del móvil son locales; la expulsión desde el panel es global.
- La renovación reutiliza la duración original y rota el token.
- No hay código de producto hasta que los mockups estén aceptados (P2).

## Decisión resuelta

**D21 — verificación de la contraseña existente: sesión primero.** Aprobada el 2026-11-16.

- La app y la web firman con Supabase Auth antes de canjear; el Core valida el `userId` de la sesión
  y no verifica contraseñas.
- Se retira `verifyPassword`; el canje de una cuenta existente sin sesión devuelve
  `409 existing_account_signin_required` y no consume la invitación.
- La alternativa de 5 intentos por token no se implementa.

El resto de la revisión está incorporado a la spec, el plan y las tareas. La siguiente puerta es
**P2 (mockups)**.
