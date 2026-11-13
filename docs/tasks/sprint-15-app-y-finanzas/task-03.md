---
id: sprint-15-task-03
titulo: OweNo v1 — mockup, módulo, API y panel
area: producto
estado: pendiente
fuente: docs/superpowers/specs/2026-11-13-owe-no.md (borrador, pendiente de aprobación); docs/tasks/sprint-15-app-y-finanzas/owe-no-intake.md; docs/tasks/sprint-15-app-y-finanzas/splitwise-export.md
mockup: docs/mockups/owe-no/index.html (borrador F1+F2, pendiente de aprobación)
plan: docs/superpowers/plans/2026-11-13-owe-no.md (borrador, pendiente de aprobación)
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: definir y construir el primer módulo de producto, OweNo v1, y dejarlo usable en
el panel. La spec, el cuestionario y **los mockups** se cierran antes de escribir DDL: primero
el esqueleto base aprobado en la tarea 01, después el esqueleto con OweNo (móvil) y las
pantallas del panel.

**Punto de partida**: no existe `packages/owe-no/`. La landing lo marca `planned`; la spec
de diseño define «Split Expenses» (gastos compartidos, balances, liquidación) y la landing
promete «presupuestos e histórico». D2 decidió gastos compartidos y D4 fijó OweNo; la landing se corrige.

**Alcance (condicionado a D3 y D9)**
- Dentro:
  - **Mockup F1 — OweNo móvil** en `docs/mockups/owe-no/index.html` (vista
    móvil, 390 px): el home del esqueleto aprobado en la tarea 01 con OweNo dentro; grupos,
    detalle con balances y gastos, alta de gasto con **reparto igual o importes exactos**,
    liquidación, **invitaciones (aceptar/rechazar)**, **gestión de miembros del creador
    (invitar, echar, bloquear)** y **salir del grupo**, estados vacío/carga/error, claro y oscuro,
    9 idiomas (copy en español para revisión).
  - **Mockup F2 — panel de control** en el mismo artefacto (vista panel, 1440 px): catálogo/ficha
    del módulo, **configuración con el deslizador de `settlement_exact_limit`**, overview, grupos,
    gastos, categorías, miembros e **invitaciones**, y la edición de un grupo por un admin; claro
    y oscuro. Si D9 incluye
    una sección «App» que previsualice las pantallas móviles, se añade aquí.
  - Spec y mockups aceptados; `manifest.json` válido con **`branding.icon` billete** y
    **`branding.color: emerald`**; DDL `up`/`down` en `module_owe_no`;
    RLS por grupo con `group_id` en todas las tablas; dominio de dinero en enteros de céntimos
    y fechas de calendario; **ciclo de vida del grupo (D15)**: cualquiera crea, el creador
    invita y el invitado acepta, echar/bloquear, salir conservando el historial, y el admin crea
    y edita desde el panel; grupos, miembros (registrados y ficticios, con **enlace manual por
    admin** y sin claiming automático),
    categorías, gastos con **reparto igual o importes exactos**, balances y liquidación determinista; API
    `/api/v1/owe-no/*` con zod; **widgets de dashboard `owe-no.summary` (app) y
    `owe-no.metric` (panel)** declarados en el manifest y resueltos por el contrato de la
    tarea 02; páginas de panel `overview`, `groups` e `imports`; **backend del importador de Splitwise** (preview/dry-run y
    commit; selector de usuarios activos; la UI vive en la app); acción de admin para enlazar un
    ficticio; `transpilePackages` y el registro de
    módulos actualizados;
    documentación por capacidad; 9 locales; landing `in-development`/panel disponible.
- Fuera: presupuestos mensuales, multi-divisa, recibos,
  OCR, recurring, claiming automático de ficticios, pantallas Android (tarea 04) y una
  sección «App» en el panel si D9 = no. El runtime de realtime/push es de la tarea 02; aquí solo
  se declaran canales/eventos y se emiten.

**Dependencias**: tarea 01 `finalizada` con el mockup A aprobado (el esqueleto base); tarea 02
`finalizada`; D2 y D4 cerradas, D3 y D9 confirmadas; spec + mockups F1 y F2 aceptados; cuenta de prueba y datos de
demo (nunca datos reales de la familia).

**Riesgos**: el mockup F1 puede revelar que el esqueleto de la tarea 01 no encaja con OweNo y
obligar a volver a la puerta del mockup A; el dominio de reparto y liquidación tiene casos
límite (residuo, redondeo, miembros que salen); el DDL y `down` no pueden borrar dinero; la RLS
debe aislar grupos; el panel de módulo depende del host de la tarea 02; la landing no puede
presentar OweNo como disponible antes de que existan pantallas reales.

**Criterios de aceptación**
- **Los mockups F1 (móvil) y F2 (panel) están en `docs/mockups/owe-no/`, cubren los estados y
  el claro/oscuro, y el propietario los aprueba antes de implementar.**
- La UI del panel y la de la app corresponden con los mockups aprobados; las desviaciones se
  explican en la revisión.
- **Un solo `movement`** (D19): un gasto y un pago comparten tabla, historial y política; un pago
  es un movimiento con una sola participación. Editar y eliminar (baja lógica) funciona para
  ambos, solo para el autor o el creador.
- **Entrada del módulo** (D20): `/modules/owe-no` lleva al resumen; la ficha está en
  `/modules/owe-no/settings`; la lista de módulos ofrece Abrir y Ajustes; el widget del panel
  enlaza al resumen.
- Manifest válido, digests correctos, docs por capacidad e i18n en los 9 locales.
- Instalar/activar/desinstalar en staging; `down` reversible y sin pérdida silenciosa de datos.
- Crear grupo, añadir gasto **eligiendo participantes** (3 de 5) con reparto igual y con importes
  exactos por persona, ver balances y
  liquidar; la suma de repartos siempre es el total y la liquidación da el **mínimo exacto** de
  transferencias hasta el **tope configurable** `settlement_exact_limit` (por defecto 12,
  ajustable de 4 a 20 con un deslizador en la configuración del módulo), verificado contra fuerza
  bruta en grupos pequeños, determinista ante saldos repetidos y con degradación a voraz y aviso
  por encima del tope. El algoritmo es propio, sin dependencia externa.
- OweNo declara en el manifest su canal por grupo (miembros del grupo, con la `members_fn` que
  el mecanismo de la tarea 02 permita) y sus `events` (`owe_no.movement_created`, `owe_no.movement_updated`,
  `owe_no.movement_deleted`, `owe_no.member_linked`) con `notify: ["push"]` donde corresponda; el evento se
  publica en el topic del grupo (Broadcast) y genera un aviso push a los demás miembros, nunca
  al autor.
- OweNo declara `owe-no.summary` (app) y `owe-no.metric` (panel); cada dashboard los
  incrusta solo si el usuario tiene acceso y el grupo tiene datos; sin datos, no inventan cifras.
- RLS: un miembro de otro grupo no ve ni modifica nada; un `invited` no ve gastos hasta
  aceptar; un `left`/`removed` deja de leer y escribir pero el historial sigue íntegro en la BD;
  un bloqueado no puede ser invitado. Tests de acceso cruzado para cada estado.
- El creador puede invitar, echar y bloquear; el invitado acepta o rechaza; salir no borra
  gastos, participaciones ni liquidaciones, y los balances históricos siguen cuadrando.
- Salir exige saldo cero; el creador puede echar a alguien con saldo y la deuda queda como
  pendiente en el historial.
- Purgar un usuario con historial en OweNo no falla: el miembro pasa a **ficticio** con su
  `display_name`, conserva gastos y deudas, y ninguna pantalla consulta `profiles` para nombrarlo.
- Un admin puede enlazar un ficticio con una cuenta y el historial se conserva; sin enlace automático; un usuario que ya es miembro no se duplica.
- API con zod, envelope ADR 0007, idempotencia en escrituras y rate limits.
- El importador de Splitwise procesa el **CSV por grupo** con preview/dry-run, errores claros y commit transaccional; **rechaza multi-divisa con aviso**; importa los pagos como liquidaciones; no deja importaciones a medias.
- Páginas `overview`, `groups` e `imports` en el panel, dentro de Plataforma → Módulos, con
datos de demo; landing actualizada en el mismo PR.
- **Datos de demo (D21, B)**: OweNo declara `demo: { seed_fn, clear_fn }` y siembra un grupo de
  prueba («Casa · Piso de Ana») con los usuarios del dataset del Core, 6 movimientos (gastos con
  y sin el pagador, 3 de 4 participantes y un pago) y balances cuadrados; limpiar el demo borra
  solo ese grupo. Las capturas de la landing y la aceptación de la tarea 04 usan estos datos,
  nunca datos reales.
- El seed de demo es idempotente y reversible: instalar dos veces no duplica, borrar deja el
  grupo vacío y ningún movimiento huérfano, y la limpieza del Core se niega mientras el grupo de
  demo siga enlazado.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter db-tests test`, `pnpm --filter admin build`,
  `pnpm i18n:check` en verde; CI en verde.

**Puertas de usuario**
- Cerrar requisitos y aprobar la spec.
- **Aprobar los mockups F1 (móvil) y F2 (panel)** antes de implementar.
- Aprobar el plan.
- Aceptar la página en el preview y compararla con el mockup F2.
- Orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (RLS, scopes, aislamiento entre
grupos, idempotencia, migraciones y datos personales).
