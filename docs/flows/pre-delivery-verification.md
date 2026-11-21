# Flujo: verificación antes de entregar

**Regla dura**: nada se anuncia al propietario —ni un «ya puedes probarlo», ni un PR listo, ni un
APK nuevo— sin haberlo ejecutado **antes** aquí. El propietario no revisa código ni PRs: su prueba
es la primera que ve el producto, así que no puede encontrar un error que ya era detectable desde
la máquina de quien lo escribió.

La verificación se hace **contra el entorno real** (instancia local o preview y base de datos de
verdad), no contra mocks. Un test unitario en verde no demuestra que la página abra.

## 1. Checklist obligatoria

| # | Comprobación | Evidencia |
|---|---|---|
| 1 | `scripts/verify-local.sh` en verde | salida pegada en la tarea/PR |
| 2 | `pnpm lint && pnpm tsc && pnpm test` desde la raíz | salida |
| 3 | Build del admin si se tocó (`pnpm --filter admin build`) | salida (ver aviso del dev server) |
| 4 | Android tocado: `./gradlew :app:testDebugUnitTest :app:assembleDebug` | recuento de tests y APK |
| 5 | Cada ruta nueva o cambiada del panel, abierta con sesión y sin texto de error | tabla ruta → código |
| 6 | Cada endpoint nuevo, llamado con sesión (200 y forma de la respuesta) | `curl` |
| 7 | Si hay UI: la página cargada en navegador con `lerd` `diag` `browser_toggle` y `request` `lenses` sin incidencias | captura o lista de lenses |
| 8 | El APK publicado se instala y arranca (no solo compila) | versión y origen del APK |

Los puntos 1, 5 y 6 los automatiza el script; el resto es manual y se pega igual.

## 1.b Flujos de invitaciones (club)

Dos scripts cubren lo que más se rompe y lo que el propietario no debe descubrir:

```bash
pnpm qa:invitations          # API real: enlace, canje nuevo, email existente, rotar, revocar, QR
pnpm qa:web                  # navegador real: página de invitación y pantallas del panel
pnpm qa:android              # la app real en el emulador/móvil conectado
```

- **`scripts/qa-invitations.sh`** levanta una sesión de verdad contra el panel local y recorre el
  ciclo completo por HTTP: acuñar y listar, preview anónimo, canje con cuenta nueva (perfil, nivel,
  plaza), canje con email ya registrado (debe ser **409** y la invitación sigue pendiente), aceptación
  confirmada con esa cuenta (sin duplicado y sin gastar plaza), reacuñar el enlace (el viejo muere),
  revocar (la plaza vuelve), QR (preview, canje único), el **ciclo de solicitudes** (pedir sin
  plazas, una segunda pendiente rechazada, quien tiene plazas no puede pedir, el administrador la
  ve, aprueba con importe, la cuota sube y ya puede invitar, rechazo con motivo y volver a pedir) y
  el presupuesto de creación tras 15 lecturas. Comprueba además los eventos
  `invitation.requested` (push a administradores) y `invitation.request_resolved` (push al
  miembro). Limpia sus `qa-invite-*@test.local` al terminar.
- **`pnpm qa:web`** (Playwright, `apps/admin/e2e`) abre la página de invitación en un navegador de
  verdad: canje con cuenta nueva hasta `/welcome`, email ya registrado que se para y pide la
  contraseña de esa cuenta, y enlace inexistente con su mensaje. En el panel inicia sesión, lista
  miembros, guarda un nivel y **aprueba una solicitud de plazas** con su importe (el miembro sin
  plazas la crea en el setup y se comprueba la concesión en su ficha). Crea sus cuentas
  `qa-e2e-*@test.local`, las borra al terminar y restaura los niveles que ajusta.
- **`scripts/e2e-android-invite.sh`** instala el APK debug y conduce la app con `adb`: comprueba que
  el enlace pinta el formulario, que un email registrado **no** entra y deja la invitación pendiente,
  y que un email nuevo canjea desde la app con su nombre, nivel e invitador. Necesita un
  emulador/móvil conectado (`INSTANCE_URL` para un móvil en la LAN).

Los dos deben estar en verde **antes** de decirle al propietario que pruebe algo del club.

## 2. `scripts/verify-local.sh`

```bash
BASE_URL=http://127.0.0.1:3003 scripts/verify-local.sh
```

Qué comprueba, con una sesión real de admin temporal (`qa-verify@test.local`, que borra al
terminar):

1. **Cada módulo instalado está entero**: fila en `module_registry`, esquema `module_<key>` con
   tablas y sus migraciones `up`. Una fila sin esquema es una instalación rota y falla aquí, no
   en el navegador del propietario.
2. **Cada página del panel responde 200** para los módulos instalados (`/panel`,
   `/panel/modules`, `/panel/modules/<key>` y cada `admin_pages[].route` del manifest) y el HTML
   no contiene `Runtime error`, `Application error` ni `relation "…" does not exist`.
3. **La API responde** con esa sesión (`/api/v1/me`, `/api/v1/modules` y los endpoints del
   módulo que declara el script).
4. **Las páginas públicas abren sin sesión** (`/login`, `/forgot-password` y
   `/migrate/<token>` con un token de forma válida) y su HTML no trae un error de ejecución: son
   la primera puerta de quien acepta una invitación, recupera la contraseña o migra de teléfono.

Rutas extra: `scripts/verify-local.sh http://127.0.0.1:3003 /panel/users /panel/settings`.

**`db-tests` contra una instancia con datos no es una suite verde**: esos tests asumen una
instancia vacía (setup, invitaciones, ajustes, categorías) y fallan contra la instancia del
propietario por sus datos, no por el código. Contra ella se ejecutan las suites del módulo
(`src/modules src/demo`) y este script; la suite completa, en CI o sobre una base limpia.

Sale con código 1 si algo falla y dice qué. **Lo que no cubre**: las suites, el build, el APK y
la navegación real en el móvil; eso van a mano (puntos 2–4 y 8).

## 3. Instalar un módulo en local: por el panel, nunca por script

El camino bueno es el que usa el propietario: **`/panel/modules` → instalar**, o
`POST /api/v1/modules/<key>/install` con sesión de admin. Ese camino abre una transacción real:
registro, DDL, migraciones y ajustes entran juntos o no entran.

Trampa que ya costó un fallo: un script de instalación con un `withTransaction` de mentira —

```ts
// MAL: no abre transacción; un fallo a mitad deja el registro sin esquema.
withTransaction: async (fn) => fn(db),
```

— deja estado parcial. `settings_categories` y `settings` viven en `public`, así que **sobreviven**
al `rollback` del DDL; de ahí que la reinstalación fallara con `duplicate key`. Por eso el
instalador hace `upsert` de los ajustes (regresión en
`packages/db-tests/src/modules/service.test.ts`, «installs again when a failed attempt left its
settings behind»).

Si de verdad hace falta por consola, abre la transacción explícita y ciérrala tú:

```ts
await c.query("begin");
try {
  await installModule(deps, caller, manifest);
  await activateModule(deps, caller, key);
  await grantUserModule(deps, caller, userId, key);
  await c.query("commit");
} catch (error) {
  await c.query("rollback");
  throw error;
}
```

Y después comprueba el estado antes de abrir nada:

```sql
select r.key, r.state, r.version,
       (select count(*) from information_schema.tables t
         where t.table_schema = 'module_' || replace(r.key, '-', '_')) as tables,
       (select count(*) from public.module_migrations m
         where m.module_key = r.key and m.direction = 'up') as migrations
  from public.module_registry r order by r.key;
```

`tables = 0` o `migrations = 0` en una fila activa = instalación rota: desinstalar y repetir.

## 4. Abrir el panel como el propietario, sin sus credenciales

El script crea un admin temporal y firma con él; para una comprobación puntual a mano, el patrón
es el mismo: usuario en Supabase Auth, fila en `profiles` con `role = 'super_admin'`, `POST
/auth/v1/token?grant_type=password` con la `anon key` y la cookie `sb-<host>-auth-token`
(`base64-` + JSON de la sesión en base64url, troceada a 3180 caracteres). Se borra el usuario al
terminar: **nunca** se pide ni se guarda la contraseña del propietario.

## 5. Dev server y build no conviven

`pnpm --filter admin build` escribe en `apps/admin/.next`, el mismo directorio que `next dev`.
Con el dev server levantado, el build lo deja vivo pero mudo (ni `localhost` ni la IP de la LAN).
Para el servidor, construye, y relánzalo:

```bash
lsof -nP -iTCP:3003 -sTCP:LISTEN -t | xargs -r kill
pnpm --filter admin build
PORT=3003 pnpm --filter admin dev
```

Si ya se rompió: `pkill -9 -f "next dev"`, `rm -rf apps/admin/.next`, y vuelve a arrancar.

## 6. Móvil

- APK de desarrollo: `./gradlew :app:assembleDebug` (`com.rferic.zero27apps.debug`, «027Apps Dev»).
  Para LAN, `-PdefaultInstanceUrl=http://<ip>:3003` y servir el APK por HTTP en el puerto `8099`.
- La clave de los APK publicados a mano es la de debug de la Mac; los del CI llevan otra y **no
  se actualizan entre sí**. Lo que se anuncie tiene que ser del mismo origen que lo instalado.
- Un APK que compila no está probado: se instala, arranca y se recorre la pantalla nueva.

## 6bis. Revisión independiente de la app móvil

Antes de avisar al propietario de que la app está lista, **un agente distinto del que la
implementó** la revisa como **QA y como diseñador**, igual que se hace con el panel:

- **QA**: flujos reales contra una instancia con datos (login, grupos, gasto, liquidación,
  invitaciones, importador), estados de error y sin conexión, importes y fechas con el locale del
  perfil, permisos por rol y por estado de miembro.
- **Diseño**: contraste y tokens (incluido `accent-foreground`), jerarquía y densidad en 390 px,
  estados vacíos/carga/error, textos en los 9 idiomas, coherencia con el mockup F1 aprobado y con
  el panel.
- Con el **APK compilado** y capturas reales; si no hay emulador ni dispositivo conectado, el
  agente revisa el código, la composición y el APK, y lo dice.

Sus hallazgos se corrigen antes de la entrega; se pega el veredicto junto al resto de la
evidencia. No se anuncia «ya puedes probarlo» sin este paso.

## 7. Si algo falla

1. No se anuncia nada; se arregla.
2. El fallo se convierte en una comprobación del script o en un test de regresión (rojo antes,
   verde después), no en una nota mental.
3. Se repite la verificación completa: un arreglo de esquema puede romper otra página.

## Referencias

- `scripts/verify-local.sh` — la parte automática.
- `docs/conventions/definition-of-done.md` — qué exige una tarea para estar `finalizada`.
- `docs/flows/local-development.md` — arranque del entorno local.
- `docs/ai/module-system.md` — contrato de módulos, instalación y ajustes.
- `docs/conventions/security-checklist.md` — la auditoría que cierra la tarea.
