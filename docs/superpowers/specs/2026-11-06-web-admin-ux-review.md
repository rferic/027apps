# Revisión de diseño y UX — panel de administración

**Fecha:** 2026-11-06 · **Alcance:** `apps/admin` (panel privado) · **Base:** `2026-11-06-web-admin-design.md`

Revisión hecha desde dos sombreros: diseñador de producto y especialista en UX. No propone
tecnología: propone decisiones de interfaz verificables.

## 1. Diagnóstico del mockup actual

Problemas observados en `apps/admin/src/app/page.tsx`:

1. **Navegación decorativa**: cinco ítems, tres con `href="#..."` (muertos) y "Gastos", que no es una
   página del Core (es de un módulo). El ítem "Dashboard" está siempre `active`, así que no hay
   orientación real.
2. **Identidad incoherente**: el wizard muestra el logo centrado a `xl`; el panel lo reduce a `md` y no
   muestra el nombre de la instancia, que es un ajuste real del producto.
3. **Sin contexto de sesión**: no se ve quién ha iniciado sesión, con qué rol, ni cómo cerrar sesión.
   Tampoco hay selector de idioma, aunque el resto del producto ya lo tiene.
4. **Datos falsos con apariencia de reales**: `Eric (Admin)`, `Sara`, `Carlos` y balances con dos
   decimales. Un `admin` recién instalado puede creer que esos miembros existen.
5. **KPIs sin semántica**: "Pendiente: 340,00 €" no dice de qué periodo, de qué fuente ni de qué
   módulo. Un número sin unidad de negocio es ruido.
6. **Jerarquía plana**: cuatro KPIs, una tabla y una navegación con el mismo peso visual; no hay una
   acción primaria ni un "qué hago ahora".
7. **Sin estados**: no hay vacío, carga ni error. Una tabla vacía se ve igual que una rota.
8. **Móvil ignorado**: tabla horizontal que desborda; navegación sin patrón móvil. El usuario real
   entra desde el teléfono.

## 2. Principios para el panel

1. **Un marco, una jerarquía**: el shell (marca + navegación + sesión) es estable; el contenido cambia.
   La página nunca repite la identidad.
2. **Agrupar por modelo mental, no por recurso de API**: el usuario piensa "personas", "mi cuenta",
   "la plataforma"; no "user_categories".
3. **Máximo 7 destinos primarios**. Lo raro o peligroso vive dentro de Configuración.
4. **Una acción primaria por página**, visible y a la derecha del título. Las secundarias, en un menú
   de acciones. Las destructivas, nunca junto a la primaria.
5. **El estado siempre es visible**: cargando, vacío, error, sin permiso. Nunca una tabla que parezca
   llena cuando no lo está.
6. **El error dice qué hacer**: mensaje traducido + `request_id` copiable + botón reintentar.
7. **Mobile-first en las listas**: en móvil, tarjetas; en escritorio, tabla. Mismos datos, distinta
   densidad.
8. **No depender del color**: rol y estado llevan texto además del token de color.

## 3. Arquitectura de información propuesta

| Grupo | Destinos | Por qué |
|---|---|---|
| **Inicio** | `/` (dashboard) | "¿Cómo está mi instancia?" |
| **Usuarios** | `/members`, `/categories`, `/invitations` | Todo lo que describe quién entra y qué puede hacer |
| **Plataforma** | `/modules`, `/keys` | Qué corre y con qué credenciales |
| **Ajustes** | `/settings/instance`, `/settings/localization`, `/settings/security`, `/settings/notifications`, `/settings/rate-limits` | Configuración de la instancia, una sección por destino |
| **Documentación** | `/docs/api` (API), `/help/firebase` (guía de Firebase, externa) | Contrato de la API y guías de integración |

Reglas:

- **Máximo un nivel de anidación** (`/members/[id]`). En el detalle, breadcrumb "Miembros / Nombre".
- **Settings no es una página única**: `/settings` redirige a la primera sección visible y cada
  categoría real tiene su ruta: `/settings/instance`, `/settings/localization`, `/settings/security`,
  `/settings/notifications`, `/settings/rate-limits`. Cada página carga y guarda solo esa categoría.
  En la navegación **no hay ítem padre "Settings"**: las cinco secciones son destinos normales del
  grupo **Ajustes**, sin `aria-expanded` ni indentación; el ítem activo es la sección y, mientras
  `/settings` resuelve la redirección, se marca activa la primera sección visible del rol.
- **Security solo para `super_admin`**: ni el menú ni la ruta se ofrecen a un `admin`, que recibe el
  403 genérico sin leer los ajustes.
- **Documentación** es un grupo propio: **API** es un destino interno (`/docs/api`) y **Guía de
  Firebase** es un enlace externo (`/help/firebase`) que abre en otra pestaña
  (`target="_blank"` + `rel="noopener noreferrer"`), con el mismo estilo de ítem, un `aria-label`
  que avisa de la nueva pestaña y sin `aria-current`.
- El **selector de idioma** va en la cabecera, junto al menú de usuario (es preferencia global, no
  navegación).
- El **menú de usuario** (avatar + nombre + rol) contiene "Cerrar sesión". Nunca un botón suelto.
- En **móvil**: drawer con la misma jerarquía y los mismos nombres; sin tabs inferiores (el panel no
  es una app de consumo).

## 4. Marca y cabecera

- Cabecera de 56–64 px: marca de 027Apps (wordmark o mark) + **nombre de la instancia** como texto; a la
  derecha, idioma y menú de usuario.
- La marca no se centra en el panel: el centro es para el contenido. La identidad va a la izquierda,
  como en cualquier consola de administración.
- Tamaño de la marca: `md` (h-8) en cabecera; nunca `xl` (eso es del wizard, que es una pantalla de marca).
- La marca es siempre la de 027Apps (wordmark o mark): no hay logo de instancia configurable.

## 5. Dashboard

- **Un titular**: el estado de la instancia ("Todo en orden" / "Configuración incompleta" / "Servicio
  degradado"), con el enlace a la acción que lo resuelve.
- **Cuatro KPIs como máximo**, cada uno con: número, etiqueta y **fuente/periodo** ("miembros activos",
  "invitaciones pendientes"). Sin moneda ni cifras de módulos que aún no existen.
- **Tarjetas de módulos**: nombre, estado y enlace. Sin métricas inventadas.
- Si no hay datos: estado vacío con la acción ("Aún no hay miembros → Invitar").
- Nunca dos bloques que digan lo mismo (KPI de miembros + tabla de miembros en la misma pantalla).

## 6. Patrones de página

- **Lista**: título + acción primaria + filtro + tabla/tarjetas + paginación. Filas clicables, con
  foco visible. Acciones de fila en un menú de tres puntos, no en columnas de botones.
- **Paginación**: toda lista se pagina en servidor (`limit`/`offset` + `total`); la UI usa
  `components/ui/pagination.tsx`, pasa `page` por query y nunca carga todos los registros para paginar
  o filtrar en cliente.
- **Búsqueda**: el texto se filtra con `components/ui/search-input.tsx` al dejar de escribir (300 ms),
  sin botón "Search" (Enter aplica al instante, Escape limpia); los selectores se aplican al cambiar y
  ambos conservan el resto de filtros y reinician `page`.
- **Detalle**: breadcrumb, título con el nombre, badges de rol/estado, formulario en una columna y
  acciones destructivas separadas al final con confirmación explícita ("Desactivar a Sara: perderá el
  acceso al instante").
- **Formularios**: etiqueta arriba, ayuda debajo, error junto al campo. Un botón primario; "Cancelar"
  como enlace. **Todo formulario con campos vive en su propia página** (`/…/new`), con breadcrumb,
  `h1` y enlace "Back"; los `<dialog>` quedan solo para confirmar acciones destructivas y para el drawer
  móvil. Un secreto que se muestra una sola vez (token de invitación, clave de API) se queda en esa
  página con "Copy" y "Done" hacia el listado, sin ofrecer una segunda creación sin salir.
- **Selección múltiple (monedas)**: combobox con chips estilo react-select (`ui/multi-select.tsx`), sin
  dependencias nuevas. El trigger muestra una chip por moneda `enabled` (`símbolo · Nombre`) y el
  desplegable lleva buscador que filtra por nombre, código o símbolo (insensible a mayúsculas y
  diacríticos) y lista con estado seleccionado. El nombre y el símbolo se derivan en cliente con `Intl`
  (la BD solo guarda `code`/`enabled`), con el código como fallback. La default es una chip fija sin
  botón de quitar. El pie muestra "{selected} of {total} selected" y "Clear all except the default"
  (deshabilitado si no hay nada que limpiar), que pide confirmación inline y aplica un `PATCH` por
  moneda no-default, refrescando una vez al terminar. Teclado: flechas mueven, Enter/Espacio alternan,
  Escape cierra y devuelve el foco al trigger. Vacío "No currencies match".
- **Confirmaciones destructivas**: nombrar el objeto y la consecuencia; nunca solo "¿Estás seguro?".
- **Feedback**: cambio guardado → mensaje breve junto a la acción; error → inline + `request_id`.

Formularios y confirmaciones usan las primitivas compartidas (ui/form.tsx, ui/dialog.tsx); ver code-style.md § Diálogos y formularios.

## 7. Accesibilidad y calidad

- Foco visible en todos los interactivos; `aria-current="page"` en el ítem activo.
- Objetivos táctiles ≥ 44 px; contraste AA en ambos temas.
- El tema es una preferencia del usuario, no solo del SO: se guarda en la cookie `027_theme`
  (`system|light|dark`) y la cabecera ofrece el selector; sin cookie manda `prefers-color-scheme`.
- Etiquetas reales (`<label>`), no `placeholder` como única etiqueta.
- Tablas con `<caption>` o título asociado; cabeceras `th`.
- Textos de menú cortos y estables: el alemán crece ~30 %; no usar frases en la navegación.
- Nada de iconos sin texto en la navegación primaria (sí en móvil, con `aria-label`).

## 8. Anti-patrones a evitar en este sprint

- KPIs decorativos o con datos de ejemplo.
- Enlaces `#` como navegación.
- "Próximamente" en destinos que ya existen.
- Ocultar acciones con CSS según rol: se compone en servidor.
- Toasts para errores de formulario (van inline).
- Un spinner de página completa para una tabla.

## 9. Checklist de aceptación UX

1. Las 8 rutas existen; ningún `href="#"` en la navegación.
2. Ítem activo visible en todas las páginas y breadcrumb en los detalles.
3. Cabecera con marca + nombre de instancia + idioma + menú de usuario con "Cerrar sesión".
4. Cada lista tiene vacío, carga y error; el error muestra `request_id`.
5. Cada página tiene una acción primaria clara y las destructivas están separadas y confirmadas.
6. En 375 px no hay scroll horizontal; las tablas pasan a tarjetas.
7. Los datos de ejemplo no existen en producción (solo en tests).
8. Rol y estado se leen sin depender del color.
9. Navegación usable con teclado (foco visible, orden lógico).
10. Los textos de menú caben en las 9 locales sin romper el layout.

## 10. Preguntas obligatorias de auditoría

Toda auditoría de una página del panel debe responder por escrito a estas tres, con `archivo:línea`:

1. **Acciones sobre uno mismo**: ¿puede el actor ejecutar cada acción destructiva o de privilegio sobre
   su propia cuenta? Si la UI la ofrece, ¿el API la rechaza? ¿Qué ve el usuario? (rol propio,
   desactivarse, revocar su propia clave, cambiar su propio email).
2. **Procedencia del dato**: cada valor visible, ¿de qué campo sale? ¿Puede ser un valor por defecto
   (semilla o `null` presentado como real)? ¿Se distingue "sin configurar" de "configurado a X"?
3. **Coherencia entre pasos**: lo que el usuario eligió en el wizard (idioma, zona, moneda, nombre),
   ¿se propagó a donde se muestra después (perfil, panel, correos)? Si no, ¿es intencionado y está
   documentado?
