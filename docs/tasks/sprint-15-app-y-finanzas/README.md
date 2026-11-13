---
id: sprint-15-app-y-finanzas
titulo: App Android real, runtime del primer módulo y OweNo v1
area: producto
estado: pendiente
---

Sprint **aprobado por el propietario el 2026-11-13**, incluidos spec, plan y mockups. La
definición vive en la rama `sprint/15-app-and-oweno` y el **PR #97** (draft contra `staging`).
Todavía no hay código de implementación.

El objetivo es doble: convertir la app Android en un **cliente real** (acceso, sesión y shell)
y preparar el **primer módulo de producto** (OweNo) sobre un runtime de módulos que hoy
existe pero nunca se ha ejercitado con un módulo real. La app de OweNo con pantallas completas
y el importador se entregan al final, como tarea 07: el propietario los ha metido en v1.

## Contexto real (verificado en el repo, 2026-11-12)

- Sprint 14 cerrado y desplegado en producción (`b6b8b51`, PR #89); `staging` y `main`
  sincronizadas (`54f7606`).
- La app Android **solo** tiene la pantalla de configuración de FCM: no hay login, ni sesión,
  ni navegación, ni pantallas de producto (`apps/android/.../MainActivity.kt`).
- El JWT de sesión que usa esa pantalla se guarda **en texto plano** en
  `SharedPreferences` (`FcmRegistrar.sessionToken`). Es un hallazgo de seguridad que la
  tarea 01 corrige.
- El instalador de módulos existe (`packages/core/src/modules/service.ts`) y valida manifest,
  digests, DDL y `admin_pages`, pero **nunca se ha instalado un módulo real**.
- `GET /api/v1/me` y `GET /api/v1/me/modules` están especificados y **no implementados**
  (`docs/api/README.md`, «previsto»). Cualquier cliente necesita ambos.
- El guard **no resuelve scopes de módulo para sesiones**: `effectiveScopes` devuelve el set
  fijo del rol, así que un usuario con una sesión de Supabase no puede llamar a un endpoint
  de módulo con `expenses:read` (`packages/core/src/auth/guard.ts`). Está previsto que llegue
  «con los endpoints del módulo», pero es un requisito previo a OweNo.
- El instalador crea el esquema `module_<key>` y solo concede `usage/create` a
  `module_installer`; **no concede privilegios a `service_role` ni a `authenticated`**, y el
  DDL del módulo tiene prohibido `GRANT` (`assertSafeModuleSql`). La API privilegiada (pooler
  `postgres`) podría leer las tablas, pero la RLS no sería verificable con un rol acotado y el
  contrato de módulo quedaría a medias.
- El DDL de un módulo **no puede referenciar `auth.`** ni crear funciones `security definer`
  (`assertSafeModuleSql`), así que no puede escribir una política RLS con `auth.uid()` sin un
  helper del Core. Es el quinto hueco del runtime.
- El panel **no sirve** `packages/<key>/admin/<route>/page.tsx` en
  `/modules/<key>/<route>`: el contrato lo exige, pero no hay ruta dinámica.
- `packages/` no se empaqueta para Vercel: `loadModuleManifest` lee
  `process.cwd()/../../packages`, que no existe en el bundle serverless. El propio código
  avisa de que «the packaging step lands with the first real module».
- OweNo no tiene spec de módulo. La landing promete «presupuestos e histórico» y la spec
  de diseño aprobada define como primer módulo **Split Expenses** (gastos compartidos,
  balances y liquidación). Hay que resolver esa contradicción antes de escribir DDL.

## Alcance: ocho tareas

**Sprint 15 (8 tareas: 7 obligatorias y 1 de extras):** app Android real, runtime del primer
módulo **partido en cuatro tareas**, OweNo usable en el panel y OweNo en la app con el
**importador de Splitwise**. La **08** es la tarea de **extras** con la que cierra el sprint: un
cambio pequeño de la web pública. Cada sprint puede terminar con una así.
El propietario metió el importador en v1 (D3.2, C) y es una función móvil, así que las pantallas
de OweNo y el importador no pueden quedar para el sprint 16.

**Por qué se parte la 02.** Concentraba ocho huecos de plataforma (grants, identidad, scopes,
host de panel, empaquetado, settings, canal, push) más la demo: demasiado para una sola
aceptación y un solo culpable cuando algo falla. Ahora son cuatro tareas con puertas propias:

- **02** instalación, aislamiento y scopes: lo que hace seguro un módulo instalado.
- **03** host de panel, ajustes y empaquetado: lo que hace visible y configurable el módulo.
- **04** realtime y push: lo que hace que los eventos lleguen.
- **05** datos de demo (D21, B): lo que permite capturas y aceptación sin datos reales.

**Sprint 16:** solo si el sprint 15 no llega al release; no se planifica aparte. La release,
las capturas reales y la landing `available` se cierran al final de la tarea 07.

El sprint **no arranca por código**: arranca por el **mockup A del esqueleto** y, para OweNo,
por los **mockups F1 (móvil) y F2 (panel)**. Sin esas puertas no se implementa UI.

El motivo no es prudencia genérica: la primera tarea de producto de este proyecto no es
«hacer una pantalla», es **estrenar el instalador, los scopes de módulo, los privilegios del
esquema, las páginas de módulo y el empaquetado serverless**. Meter además todas las pantallas
móviles en el mismo sprint retrasa la primera validación real del runtime hasta el final.

**Coste:** el sprint es más largo que el de tres tareas. Se mitiga con puertas intermedias:
la 01 se acepta sola; 02, 03 y 04 se aceptan cada una con sus tests; la 05 con la siembra en
staging; la 06 tiene mockups F1/F2 y preview; y la 07 llega al final con el importador y las
capturas. No hay una única aceptación al final.

## Fase de diseño y mockups (puerta previa a código)

El flujo de módulos y el DoD de Diseño exigen **mockup aceptado antes de implementar**
([`new-module.md`](../../flows/new-module.md) fase 7; [`definition-of-done.md`](../../conventions/definition-of-done.md)
§Diseño). No lo convierto en una quinta tarea porque el límite es cuatro: es la **primera fase
obligatoria** de la tarea 01 y de la tarea 06, con su propia puerta de aceptación. Sin mockup
aprobado, la tarea no pasa a `en curso`.

La **spec de OweNo** está en
[`2026-11-13-owe-no.md`](../../superpowers/specs/2026-11-13-owe-no.md) y su **plan** en
[`2026-11-13-owe-no.md`](../../superpowers/plans/2026-11-13-owe-no.md). El **plan del runtime**
(02–05) está en
[`2026-11-13-module-runtime.md`](../../superpowers/plans/2026-11-13-module-runtime.md), con una
sección por tarea y una aceptación por sección. La
spec cubre el modelo (un solo `movement`), la RLS, la liquidación exacta, el importador y el
panel; el plan ordena el trabajo en fases con TDD y sus puertas. Spec, mockups y plan se
aprueban juntos: sin esa aprobación no se escribe DDL ni código.

| Mockup | Artefacto | Qué muestra | Puerta |
|---|---|---|---|
| **A. Esqueleto base de la app** | `docs/mockups/app-shell/` (+ `README.md` y previews) | Variante **B** (`Inicio · Módulos · Ajustes`), arranque con instancia por defecto (sin pedir URL), login, invitación por deep link, dashboard con widget de demo, campana, FAB, ajustes con idioma/tema y cambio de instancia, estados de carga/error, claro y oscuro. OweNo con logo **F · Billete** y acento **esmeralda**. | **Aprobado 2026-11-12.** |
| **F1. OweNo móvil** | `docs/mockups/owe-no/index.html` (vista móvil) | El mismo esqueleto con OweNo dentro: **inicio del módulo con cabecera fija y menú ⋯**, grupos, detalle, alta de gasto con **participantes**, balances, liquidación, invitaciones, miembros del creador, salir del grupo, importador en cuatro pasos y grupo grande con aviso; estados vacío/carga/error; claro y oscuro. | **Aprobado 2026-11-13.** |
| **F2. Panel de control** | `docs/mockups/owe-no/index.html` (vista panel) | El panel real: `aside` de 220 px, cabecera de 64 px y el módulo dentro de **Plataforma → Módulos** con migas y pestañas. Dashboard con el **widget de panel**, ficha con el **deslizador** (hoja/llama), resumen, grupos e importaciones; claro y oscuro. | **Aprobado 2026-11-13.** |

Reglas de los mockups:

- **HTML+JS** en `docs/mockups/<nombre>/`, no una imagen suelta: el propietario debe poder
  recorrer los flujos. Se acompañan de `README.md` con las pantallas, los estados y las
  decisiones, y de PNG a 390 px (móvil) y 1440 px (panel) para revisión rápida.
- **Tokens semánticos** de la identidad D (`apps/admin/tokens.json`), claro y oscuro, con
  contraste AA verificado en ambos modos. Nada de hex libres.
- Copy en español para revisar tono; la implementación publica los 9 idiomas. Los importes y
  nombres son **de demo**, nunca de la familia.
- El mockup A se aprueba primero. F1 y F2 **reutilizan** el esqueleto aprobado (variante B); si F1 cambia la
  navegación o el home, se vuelve a la puerta de A.
- Un mockup aprobado es el contrato visual de la implementación: la UI aceptada debe
  corresponder con él; una desviación se explica en la revisión, no se cuela.

**Sobre «las pantallas de la app en el panel de control» (decidido 2026-11-12):** el mockup F2
cubre **solo** las páginas de administración del módulo en el panel (catálogo, ficha, overview,
grupos, gastos, balances, miembros). **No** se añade una sección «App» nueva que previsualice
las pantallas móviles; eso queda fuera de alcance.

## Decisiones del propietario (2026-11-12)

- **Panel:** solo las páginas de administración de OweNo (mockup F2). Sin sección «App» nueva.
- **Variantes:** se diseñan A (Inicio · OweNo · Ajustes) y **B (Inicio · Módulos · Ajustes)**.
  **B elegida** (2026-11-12): OweNo se abre dentro de Módulos, no como pestaña.
- **Inicio:** es un **dashboard de widgets aportados por los módulos**. Si un módulo declara un
  widget, el dashboard lo incrusta; si no, no aparece. No es una pantalla fija de tarjetas.
- **Grupos:** las categorías actuales del Core son etiquetas/acceso y todos ven a todos. Cada
  módulo tiene sus propios grupos (OweNo tendrá los suyos). **El esqueleto no lleva selector
  global de grupo**; el contexto de grupo vive dentro del módulo.
- **Invitación:** **deep link en v1**. App Links para el dominio canónico + esquema propio
  `027apps://invite` para instancias autoalojadas. Si la app está instalada, abre el alta; si
  no, la web `/invite/<token>` muestra el alta y el botón de descarga. La app canjea el token,
  entra y aplica el idioma inicial de la invitación. Sin deferred deep link en v1.
- **Sesión:** “login para siempre”: al abrir, si hay sesión válida entra directo al dashboard;
  si no, login. El refresh se guarda cifrado y se renueva en silencio; si se revoca, se pide
  login.
- **Idioma y tema:** la invitación marca el idioma inicial; Ajustes permite cambiarlo y se
  guarda en el perfil. El tema también se elige en Ajustes y se guarda en el perfil.
- **Campana y FAB:** ambos en el esqueleto. La campana está vacía mientras FCM esté bloqueado;
  el FAB abre una hoja de acciones de módulos (OweNo aporta «Gasto» en la tarea 07).
- **Admin:** solo en el panel; la app no gestiona invitaciones, permisos ni módulos.
- **Importador de Splitwise:** en v1 y **en la app**, para el **creador del grupo**. Sin Pro: **solo CSV por grupo** (nada de JSON/API). Multi-divisa se **rechaza con aviso**; pagos como liquidaciones; autoenlace por **nombre exacto y único**; sin coincidencia, selector de **cualquier usuario activo** (id + nombre) o crear ficticio; fusión. El CSV no trae emails, así que no hay autoenlace por email. El panel solo conserva el enlace manual de ficticios (admin).
- **Lanzador de módulos:** **cuadrícula elegida**; solo módulos **activos**, sin tarjetas
  «Próximamente». El **logo** manda, sobre tile sólido con el **acento** (`branding.color`) del
  módulo y tarjeta teñida; texto legible en claro y oscuro. Lista y Destacado son comparaciones
  del mockup, no una preferencia de producto.
- **Logo de OweNo:** ocho direcciones propias en `docs/mockups/app-shell/logos.html` (A pila
  de monedas, B monedas en abanico, C dos monedas, D cartera + moneda, E cartera minimalista, F
  billete, G billete + moneda, H cartera con billetes; sin tick), monocromas y a 24/32/40 px.
  La decisión cerrada es **F · Billete + Esmeralda**: logo de billete y `branding.color` emerald.
  La página `logos-final.html` permite comparar con los otros finalistas (H cartera con billetes y
  Recibo + check), pero la base es F + Esmeralda. Nada de iconos de librería.

**Consecuencia detectada:** el contrato canónico del manifest (`docs/ai/module-system.md`,
`docs/ai/manifest.schema.json`) **no tiene `widgets`**. El dashboard de widgets obliga a un
cambio de contrato: declaración en el manifest, esquema, docs, CI, resolución de datos y
render nativo en la app. Es un cambio `module-contract` y entra en la tarea 03; OweNo declara
su widget en la tarea 06. Sin cerrar el contrato, el dashboard no puede incrustar widgets reales.

## Tareas (orden por dependencia y valor)

| Orden | Tarea | Tipo | Depende de | Por qué en esta posición |
|---|---|---|---|---|
| 1 | [task-01](task-01.md) — App Android: mockup, acceso, invitación, sesión y shell | feature + diseño | — | Es independiente del módulo, corrige el token en texto plano y da al propietario algo instalable. Incluye el mockup A, el **host de widgets**, la **invitación por deep link**, idioma/tema, campana y FAB. |
| 2 | [task-02](task-02.md) — Módulo: instalación, aislamiento y scopes | feature + infra | — (paralelo con 01) | Grants, identidad para RLS, scopes y la regla de FK que no rompe el borrado de usuarios. Es el cimiento de todo lo demás. |
| 3 | [task-03](task-03.md) — Módulo: host de panel, ajustes y empaquetado | feature + contrato | 02 | Hace visible el módulo: páginas, widgets (D10), settings con rango y control (D3.7), entrada por resumen (D20) y bundle serverless. |
| 4 | [task-04](task-04.md) — Módulo: realtime, canales y push | feature | 02 (paralelo con 03) | Cierra el canal de módulo y el push sin autor; el runtime del Core ya existe. |
| 5 | [task-05](task-05.md) — Datos de demo del Core y de los módulos | feature + contrato | 02, 03 | Habilita capturas y aceptación sin datos reales (D21, B), con gate en producción y sin emails. |
| 6 | [task-06](task-06.md) — OweNo v1: mockup, módulo, API y panel | feature + diseño | 01, 02–05 + D3, D9 | Primer módulo real; valida el runtime y deja OweNo usable en el panel. Incluye los mockups F1 y F2. |
| 7 | [task-07](task-07.md) — OweNo en Android: pantallas, importador y capturas | feature | 01 y 06 | **Obligatoria**: el importador es móvil (D3.2) y es el producto v1. Cierra pantallas, importador, capturas y landing `available`. |
| 8 | [task-08](task-08.md) — Extras: descarga con icono de Android y literal | feature (web) | — | **Extras**: cierra el sprint con un cambio pequeño y visible de la landing. Se hace al final, cuando el resto está en verde. |

Las tareas 01 y 02 no comparten estado: pueden ejecutarse en paralelo por agentes distintos. La
03 y la 04 también pueden ir en paralelo sobre la 02. La 05 necesita la ficha del módulo (03). La
06 no empieza hasta que 02–05 estén `finalizadas` y el propietario haya cerrado la spec y los
mockups F1/F2. La 07 no empieza hasta que 01 y 06 estén `finalizadas`. La 08 es independiente y va la última.

`task-07.md` es obligatoria en este sprint. No se mueve al sprint 16: el importador forma parte
de la v1 y es una función de la app.

## Por qué no una sola tarea «app + OweNo»

- El esqueleto de la app (01) es independiente del módulo; las pantallas de OweNo (04) dependen
  del módulo (03). Por eso son tareas separadas: el shell no espera al módulo, pero las pantallas
  y el importador sí.
- OweNo necesita una spec de módulo con cuestionario, mockup aceptado y decisión de
  producto (presupuestos vs gastos compartidos). La app necesita su propio mockup de esqueleto,
  pero no la decisión de producto.
- El runtime del módulo tiene cinco huecos de plataforma que deben cerrarse **antes** de
  escribir el dominio de OweNo; si se mezclan, un fallo del instalador se confunde con un
  fallo del módulo.
- Un sprint de ocho tareas con una sola puerta de aceptación al final es el escenario que
  el flujo de `feature.md` evita. Aquí la aceptación no se deja al final: 01 se acepta sola, 03
  tiene sus mockups y preview, y 04 llega con el importador y las capturas. Las puertas
  intermedias son la mitigación.

## Fuera de alcance y bloqueos (no se tocan)

| Tema | Estado | Por qué |
|---|---|---|
| FCM / notificaciones push | **Dentro de v1 por decisión D12** (2026-11-12) | El propietario eligió realtime + push. Sigue **pendiente de credenciales**: proyecto Firebase, `google-services.json` de la app y cuenta de servicio para el envío desde el backend. Cada instancia autoalojada necesitará las suyas. La tarea 01 retira la pantalla manual de FCM; el registro de dispositivos, el envío se implementa en la tarea 04 y la bandeja real en la 07. |
| Backup 3-2-1 | Bloqueado | Sin segundo bucket en otro proveedor. |
| Storage / backups de ficheros | Bloqueado | Sin buckets en uso. |
| Revisión nativa de traducciones | Descartada por el propietario | No se reabre. |
| ESLint 10 (#33) | Fuera de sprint | El PR está en verde; el propietario lo reservó para una migración dedicada. No es urgente y no compite con el producto. |
| Capturas reales del panel | Diferida | Llegan con la página de OweNo en el panel (tareas 06/07) y datos de demo. |
| Importador de Splitwise | **En v1, en la app** (C, decidido 2026-11-12) | CSV **por grupo**; lo usa el **creador del grupo**. **Rechaza multi-divisa con aviso**; pagos como liquidaciones; autoenlace por **nombre exacto y único**; sin coincidencia, selector de usuarios activos o ficticio; fusión. **Sin Pro no hay JSON/API**: el CSV no trae emails, así que no hay autoenlace por email. Informe en [`splitwise-export.md`](splitwise-export.md). |
| Multi-divisa, recibos, OCR, presupuestos (si se elige gastos compartidos) | Fuera de v1 | Se deciden en la spec de OweNo; la v1 debe ser pequeña y verificable. |

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El instalador no concede privilegios sobre el esquema del módulo | La API privilegiada puede leer, pero la RLS no se puede verificar ni el módulo cumple el contrato | Tarea 02: grants explícitos tras las migraciones, con test de acceso real y test negativo antes de instalar. |
| El DDL no puede usar `auth.uid()` ni crear funciones `security definer` | Las políticas RLS del módulo no se pueden escribir | Tarea 02: helper de identidad compartido, `search_path` controlado y tests de aislamiento. |
| El guard no resuelve scopes de módulo para sesiones | La app recibe 403 en todos los endpoints de OweNo | Tarea 02: resolución por petición con `has_module_access` + scopes del manifest, con tests de usuario con y sin grant. |
| El panel no sirve `admin_pages` | OweNo no tiene pantalla en el panel | Tarea 02: host `modules/[key]/[route]` con registro estático generado y gate por rol/estado. |
| `packages/` no viaja al bundle de Vercel | Instalar OweNo falla en producción | Tarea 02: copia de paquetes al build + `MODULES_ROOT` + `outputFileTracingIncludes`, verificado en preview. |
| La landing y la spec de diseño discrepan sobre OweNo | Se implementa el producto equivocado | D2 decidido: gastos compartidos; D4: OweNo. La landing se corrige en el mismo PR de la tarea 06. |
| Las credenciales FCM no están configuradas en la instancia | El push no se puede aceptar en el dispositivo y la tarea 07 llega a medias | El propietario las pega en el panel (Ajustes → Notificaciones) siguiendo `/help/firebase`; no pasan por el chat ni por git. Sin ellas, el realtime sigue funcionando y el push se pospone sin rehacer código. |
| Las tablas del módulo referencian `profiles` sin `on delete set null` | Borrar un usuario falla por clave foránea y deja el panel atascado | D16: regla de contrato, validación en la tarea 02 y test de purga con el fixture y con OweNo. |
| Cada instancia autoalojada necesita su propio proyecto Firebase | El push no funciona en instancias de terceros y el producto promete algo que no entrega | Documentarlo en `docs/infrastructure.md` y en la guía de autoalojado; la app degrada a «sin notificaciones» si no hay credenciales. |
| No hay cuenta de prueba segura en producción | No se puede aceptar el login en la app | El propietario crea una invitación temporal, la canjea y la usa en el dispositivo; se purga al terminar. Sin contraseñas en el chat. |
| El propietario no tiene dispositivo Android a mano | La aceptación de la app se retrasa | CI publica `apk-debug`; la aceptación puede hacerse en un emulador o en el dispositivo del propietario. |
| Sprint largo con una sola aceptación | Se descubre tarde que el producto no encaja | Puerta de spec + mockup de OweNo antes de implementar; aceptación de la app en la tarea 01, no al final. |
| El mockup del esqueleto se salta o se aprueba tarde | Se implementa una navegación que luego no encaja con OweNo | Mockup A antes de la tarea 01; F1 y F2 antes de la tarea 06; el esqueleto aprobado se reutiliza. |
| El mockup de panel no cubre lo que el propietario espera | Se descubre al final que faltan pantallas de administración | Mockup F2 con catálogo, ficha, overview, grupos, gastos, balances y miembros; D9 decidido: sin sección «App» nueva. |
| El contrato de widgets no existe y el dashboard no puede incrustar módulos | El Inicio queda como una lista de tarjetas y el requisito del propietario no se cumple | D10 y tarea 03: contrato en el manifest, endpoint de dashboard, render nativo y tests; OweNo declara su widget en la tarea 06. |
| El importador de Splitwise en v1 amplía demasiado la tarea 06 | El sprint se alarga y mezcla módulo + migración | Ya está separado: la 06 hace el backend del importador y la 07 la UI móvil, el mapeo y el commit. El parser ya está cerrado con el CSV de muestra. |
| No hay release con APK y el botón «Descargar app» no tiene destino | El alta sin app no puede completarse por descarga | Publicar una release firmada con el APK (orden explícita) o mostrar «Descargar app (próximamente)» y mantener el alta en el navegador. |

## Puertas del propietario

1. **Aprueba este sprint** con las 8 tareas (decidido: el importador es móvil y entra en v1; la 02 se partió en 02–05; la 08 es extras).
2. **Responde D3 y D9** (límites de v1 y alcance del panel). D2 (gastos compartidos) y D4
   (OweNo) ya están cerradas.
3. **Aprueba la spec de la tarea 01** y, después, su **mockup A** (esqueleto base). El plan se
   implementa solo con el mockup A aceptado.
4. **Confirma la URL de instancia por defecto**, el idioma inicial de la invitación y el
   fingerprint de firma para App Links.
5. **Crea la cuenta temporal** de aceptación por invitación; no comparte la contraseña.
6. **Aprueba la spec y los mockups F1 y F2** (OweNo móvil y panel) antes de que la
   tarea 06 pase a `en curso`.
7. **Acepta el APK** de la tarea 01 en un dispositivo y da la **orden explícita de merge**.
8. **Configura Firebase en el panel** (Ajustes → Notificaciones) siguiendo `/help/firebase`.
   Es una puerta de **implementación**, no de definición: se hace antes de empezar la tarea 07,
   o se acepta entregarla con el push deshabilitado. Las credenciales no pasan por el chat.
9. **Publica una release con APK** (o acepta que «Descargar app» apunte a Releases y aún no
   haya APK), para que el alta sin app tenga destino.
10. **Ordena la promoción** `staging → main` como PR aparte, cuando corresponda.

## Decisiones que necesito del propietario

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | Alcance del sprint 15 | 3 tareas (OweNo Android al sprint 16) / 4 tareas (todo) / partir la 02 | **8 tareas** (decidido 2026-11-13: el importador entra en v1, el runtime se parte en 02–05 y la 08 es extras) |
| D2 | Qué es OweNo v1 | Gastos compartidos, balances y liquidación · presupuestos · ambos | **Gastos compartidos** (decidido 2026-11-12; la landing se corrige) |
| D3 | Límites de OweNo v1 | Miembros ficticios con **enlace manual por admin** (sin claiming automático); **importador de Splitwise en v1** (C, decidido; CSV por grupo, **sin Pro → sin JSON/API**, autoenlace por nombre, **rechaza multi-divisa con aviso**); **reparto igual o importes exactos** por persona (sin porcentajes ni pesos); **liquidación con el mínimo exacto de transferencias** (B, decidido), con tope configurable por setting del módulo (`settlement_exact_limit`, 4–20, defecto 12, deslizador en el panel) y voraz con aviso por encima; sin presupuestos; monomoneda por grupo | **En discusión** (D3.1 ficticios, D3.2 importador, D3.3 multi-divisa, D3.4 CSV sin Pro, D3.5 reparto B, D3.6 liquidación B, D3.7 tope configurable y D3.8 sin presupuestos/recibos decididos 2026-11-12) |
| D4 | Identidad del módulo | `owe-no` / «OweNo» · logo F billete · `branding.color` emerald | **`owe-no` / «OweNo», logo F, color emerald** (elegido 2026-11-12; la landing se actualiza en el PR del módulo) |
| D5 | App Android | Instancia de producción por defecto (sin pedir URL al arrancar); cambio en Ajustes con cierre de sesión + enlace discreto en login para autoalojados; idioma inicial de la invitación + selector en Ajustes; tema del perfil + selector; deep link de invitación (App Links + esquema propio) | **Confirmar** |
| D6 | Cuenta de prueba | Invitación temporal en producción, canjeada por el propietario, purgada al terminar | **Confirmar** |
| D7 | FCM, 3-2-1 y Storage | Siguen bloqueados; no se tocan | **Confirmar** |
| D8 | ESLint 10 (#33) | Fuera de sprint 15; migración dedicada | **Confirmar** |
| D9 | Panel de control | Solo páginas de administración del módulo · además una sección «App» nueva | **Solo las páginas del módulo** (decidido 2026-11-12) |
| D10 | Contrato de widgets del dashboard | Widgets declarativos genéricos renderizados nativamente por superficie (`app`/`panel`) · componente nativo por módulo · HTML/JS del módulo en WebView | **Widgets declarativos genéricos**; el manifest declara `surface` y el módulo puede aportar app, panel, ambos o ninguno; el HTML/JS queda descartado por seguridad |
| D11 | Deep link de invitación | Web + login · App Links para el dominio canónico + esquema propio para autoalojadas · solo esquema propio | **App Links + esquema propio + web** (decidido 2026-11-12) |
| D12 | Fingerprint de firma para App Links | El propietario entrega el SHA-256 del certificado de release | **Pendiente de entrega**; sin él, el esquema propio sigue funcionando |
| D13 | Realtime y notificaciones | A · sin realtime ni push · B · realtime sin push · C · realtime + push | **C** (decidido 2026-11-12). Transporte: **Supabase Broadcast privado publicado por el servidor**, que **ya existe** (`event_outbox`, `module_channels`, `core_can_subscribe`, push FCM data-only); falta **cerrar el canal de módulo** (`members_fn`) y **el cliente de la app**. Push: FCM **ya implementado**; faltan **las credenciales en la instancia** (las configura el propietario en el panel, nunca por chat ni git) y la localización de los avisos. |
| D14 | Control del tope de liquidación | Valor fijo en código · setting del módulo con deslizador | **Setting con deslizador** (decidido 2026-11-12): `settlement_exact_limit`, 4–20, defecto 12; exige rango y control en el contrato de settings y formulario editable en el panel (tarea 03). |
| D15 | Ciclo de vida del grupo | Solo el panel crea · solo la app crea · ambos | **Ambos** (decidido 2026-11-12): cualquier usuario crea desde la app, los admins también desde el panel; **el creador invita y el invitado acepta**, puede **echar y bloquear**; **salir** corta el acceso pero **conserva el historial**; un admin edita el grupo desde el panel. |
| D16 | Borrado definitivo de un usuario | El miembro desaparece · el miembro pasa a ficticio conservando el historial | **Pasa a ficticio** (decidido 2026-11-12). `display_name` copiado, `user_id` con `on delete set null`, tipo derivado de `user_id is null`. Regla de contrato: toda FK de módulo a `profiles` lleva `on delete set null`, porque `purgeUser` solo limpia `public.*`; la tarea 02 lo valida y lo prueba con el fixture. |
| D17 | Participantes de un gasto | Todo el grupo · subconjunto elegido por gasto | **Subconjunto por gasto** (decidido 2026-11-13): en un grupo de 5, tres helados se reparten entre 3. El pagador puede no participar; mínimo un participante; solo miembros `active`. |
| D18 | Recordar la última ubicación | Abrir siempre en el inicio · recordar módulo o página | **Recordar** (decidido 2026-11-13): se guarda `home`, `modules` o `module:<key>`; al abrir se restaura la **pantalla raíz** del módulo (nunca un formulario). Lo implementa el shell (tarea 01). |
| D19 | Gasto y pago: una entidad o dos | Dos tablas inmutables · **un solo movimiento** con edición y baja lógica | **Un solo `movement`** (decidido 2026-11-13): gasto = N participaciones, pago = una (el receptor). Se edita y se borra (baja lógica) siendo autor o creador; nunca se reescribe el historial de otro. |
| D20 | Entrada al módulo en el panel | `/modules/<key>` = ficha · **= resumen, ficha aparte** | **Resumen** (decidido 2026-11-13): `/modules/<key>` redirige a `overview`; la ficha vive en `/modules/<key>/settings` (ruta reservada) y la lista de módulos ofrece **Abrir** y **Ajustes**. |
| D21 | Datos de demo | Módulo `demo` (A) · capacidad del Core con ajuste y botón (B) · script de operador (C) | **B** (decidido 2026-11-13). El Core crea usuarios e invitaciones (el SQL del módulo no puede tocar `auth`/`public`), con correos `@example.test` **sin envío real**, solo fuera de producción, ids estables y limpieza que se niega si un módulo tiene datos enlazados. A es B más un módulo envoltorio; C no tiene botón ni gate. |

## Reglas del sprint

- Un PR por sprint, en draft contra `staging` desde el arranque. Nada de merge sin orden
  explícita. La promoción a producción es un PR `staging → main` aparte.
- Nada se implementa sin spec aprobada, **mockup aceptado** y plan aprobado. La tarea 01 no
  empieza sin el mockup A; la tarea 06 no empieza sin spec, requisitos cerrados y los mockups
  F1 y F2 aceptados.
- TDD, zod en los bordes, tokens semánticos, auditoría de seguridad incondicional antes de
  `finalizada`, y revisión/QA por un agente distinto del autor.
- Implementar OweNo incluye actualizar `docs/ai/landing.md` y las dos páginas públicas en
  el mismo PR. Sin eso, la tarea no está `finalizada`.
- La rama del sprint será `sprint/15-app-and-oweno` (nombre en inglés, según `AGENTS.md`);
  el directorio de tareas es `docs/tasks/sprint-15-app-y-finanzas/`.
