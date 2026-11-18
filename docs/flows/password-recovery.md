# Recuperación de contraseña

Cómo alguien que no puede entrar recupera el acceso sin llamar a nadie, y qué garantiza el sistema
para que el proceso no sirva también para descubrir qué cuentas existen. Contrato en la spec
[`2026-11-16-invitation-session-migration-design.md`](../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
(§7.6); implementación en `packages/core/src/auth/password-recovery.ts` y
`apps/admin/src/app/{forgot-password,auth/confirm,reset-password}`.

## Qué resuelve

El usuario pide el enlace desde `/forgot-password`, lo recibe por correo, lo abre, elige la nueva
contraseña y vuelve a entrar. No hay contraseña temporal, ni intervención del administrador, ni
correo con la contraseña.

## Camino completo

1. **`/forgot-password`** — pide el email y responde **siempre lo mismo**, exista o no la cuenta.
2. **Servidor** (`requestPasswordReset`):
   - dos presupuestos por hora: **5** por IP y **3** por email (el email se guarda hasheado en el
     contador);
   - suelo de respuesta común de **700 ms** en todos los caminos, para que el tiempo no delate nada;
   - un email desconocido, una cuenta desactivada, un rate limit o un envío correcto terminan igual;
   - el correo sale en el idioma del perfil con el nombre de la instancia y un enlace a
     `/auth/confirm?token_hash=…&type=recovery&next=/reset-password`.
3. **`/auth/confirm`** — el GET solo pinta un botón; **no consume** el token. Los escáneres de enlaces
   del correo (Outlook, antivirus) hacen GET antes que la persona: si verificara ahí, el enlace
   llegaría muerto. El POST (`confirmRecoveryAction`) es el que verifica el OTP y redirige.
4. **`/reset-password`** — con la sesión de recuperación, pide la contraseña dos veces y la guarda.
5. La persona vuelve al panel o a la app con la contraseña nueva. Las demás sesiones siguen abiertas
   salvo que se revoquen (ver [migración](../tasks/sprint-16-invitation-session-and-migration/task-10.md)).

## Garantías

- **No es un oráculo de cuentas**: misma respuesta, mismo tiempo y mismo mensaje para existente,
  inexistente, desactivada o limitada.
- **Un solo uso y caducidad corta**: el token es de Supabase (`type: recovery`); el servidor solo
  transporta el hash, nunca el token completo.
- **No se envía a cuentas desactivadas**: recuperar la contraseña no reactiva nada.
- **Un GET no gasta el enlace** (S2).
- **Nada de contraseñas en logs**: ni en el servidor ni en el correo.
- **`no-store`/`noindex`/`no-referrer`** en `/forgot-password`, `/auth/confirm` y `/reset-password`.

## Desde la app

El login de Android muestra «¿Has olvidado la contraseña?» y abre
`<instancia>/forgot-password` en el navegador del teléfono. El enlace del correo vuelve a la web: la
app no recibe el token de recuperación, porque el teléfono que recupera puede no ser el que tiene la
sesión.

## Probar en local

1. `supabase start` (Mailpit incluido) y el admin en marcha.
2. `/forgot-password` con una cuenta de prueba → el correo aparece en Mailpit
   (`http://127.0.0.1:54324`).
3. Abre el enlace **dos veces en el mismo navegador**: la primera lleva al formulario, la segunda ya
   no vale (token gastado por el POST, no por el GET).
4. Cambia la contraseña, cierra sesión y entra con la nueva.
5. Pide el enlace cuatro veces seguidas con el mismo email: los tres primeros llegan y el cuarto ya
   no (3/hora), pero la pantalla responde lo mismo las cuatro veces.
6. Con una cuenta desactivada: la pantalla responde igual y **no** llega correo.

## Operación

| Qué pasa | Qué hacer |
|---|---|
| No llega el correo | comprobar el proveedor SMTP (Mailpit en local, el proveedor real en staging/producción) y los rebotes del dominio; el límite es 3/hora por email y 5/hora por IP |
| El enlace dice que no es válido | caducó o ya se gastó; se pide otro desde `/forgot-password` |
| La cuenta está desactivada | no se puede recuperar a propósito: la reactiva un administrador desde el panel |
| Se cambió la contraseña pero la app sigue con la sesión vieja | la sesión existente es válida hasta que se revoca; cerrar sesión y entrar de nuevo |

## Puerta de usuario

Probar con un **email real** en staging o producción (el proveedor real, no Mailpit) antes de dar la
tarea por `finalizada`: entrega, caducidad del enlace y cambio de contraseña.
