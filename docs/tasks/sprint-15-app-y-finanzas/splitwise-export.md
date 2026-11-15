# Splitwise — qué ofrece para exportar los datos

**Fecha:** 2026-11-12
**Para:** importador de OweNo v1
**Estado:** investigación; no es spec. La decisión de multi-divisa ya está tomada: el importador
rechaza y avisa.

## Resumen

Splitwise ofrece **tres vías** de salida, y no son equivalentes:

1. **CSV por grupo o amistad** (`Export as spreadsheet`). Es la vía gratuita y la que va a usar
   OweNo v1. Una fila por transacción, una columna por persona, sin emails.
2. **JSON backup completo de la cuenta** (solo Pro). Incluye todos los datos de la cuenta; el
   esquema no está documentado públicamente.
3. **API self-serve** (OAuth, con límites y posiblemente Pro). No entra en v1.

La consecuencia directa para OweNo: **el CSV no permite autoenlazar por email**. El autoenlace
por email solo es posible si el export trae emails (JSON backup o API) o si el usuario los
teclea en el mapeo.

## 1. CSV por grupo o amistad

**Dónde está.** En la **web** (`splitwise.com`), dentro del grupo o amistad, icono de
ajustes/engranaje → **“Export as spreadsheet”**. **La app móvil no lo ofrece**: comprobado por el
propietario el 2026-11-13, que tuvo que hacerlo desde el navegador. La base de ayuda oficial
menciona la app, pero la app real no muestra la opción; el tutorial de OweNo dice «web» y no
depende de que Splitwise la añada. Desde el móvil se abre la web en el navegador y el CSV se
descarga en el dispositivo.

**Alcance.** Es **por grupo o por amistad**, no por cuenta: hay que repetir la exportación por
cada grupo. No hay “exportar todo” en CSV. No hay filtro de fechas: sale todo el historial del
grupo.

**Formato confirmado** con un export real (2026-11-13, cuenta en español, grupo de dos
personas; muestra anonimizada en [`fixtures/splitwise-demo.csv`](fixtures/splitwise-demo.csv)):

```text
Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis
2023-07-22,Vuelos,Avíon,567.46,EUR,-283.73,283.73
2023-09-18,Pago,Pago,180.76,EUR,180.76,-180.76
```

- **La cabecera va en el idioma de la cuenta**, no en inglés. Este export trae `Fecha`,
  `Descripción`, `Categoría`, `Coste` y `Moneda`. El importador acepta **ES y EN** como mínimo
  (`Date`, `Description`, `Category`, `Cost`, `Currency`) y rechaza con un error claro si falta
  alguna columna obligatoria.
- **Una columna por persona**, con el **impacto en su balance**: positivo si puso dinero,
  negativo si debe. La cabecera de esa columna es el **nombre** de la persona.
- La suma de las columnas de personas de una fila es el coste (lo que uno paga, los demás lo
  deben). Eso reconstruye el pagador y las participaciones sin un formato de «shares» aparte.
- **Fecha** en ISO `YYYY-MM-DD`.
- **Decimales** con `.` y sin separador de miles. Los importes son positivos; el signo vive en
  las columnas de personas.
- **Pagos**: la fila trae `Categoría = Pago` (o `Payment` en inglés) y el impacto es `+coste` en
  quien paga y `-coste` en quien recibe. Es un marcador fiable: se importan como
  **liquidaciones** (`kind: settlement`).
- **Filas en blanco o con celdas de espacios**: se descartan y se cuentan aparte. El export real
  trae una fila final con `Coste` vacío pero impactos válidos (`+212.50/-212.50`): el importador
  **deriva el importe** de los impactos, lo marca como «derivado» en el preview y no la rechaza.
- **Sin emails**: las personas van por nombre. El autoenlace por email no es posible desde el
  CSV (decisión D3.4: sin Pro, sin JSON ni API).

**Qué incluye:**

- Gastos y **pagos** (ver arriba).
- Categorías del catálogo de Splitwise, en el idioma de la cuenta.
- Nombres de los participantes en las cabeceras.

**Qué no incluye:**

- **Emails**, comentarios, fotos de recibos, adjuntos, recordatorios ni solicitudes de pago.
- Un identificador estable de gasto o de grupo (el archivo es del grupo; no hay `expense_id`).
- Un desglose de «reparto» separado: se deduce del impacto por persona.
- Garantía sobre gastos borrados: depende del momento del export.

**Multi-divisa.** Cada fila lleva su `Moneda`/`Currency`. Un grupo de Splitwise puede mezclar
divisas. OweNo v1 es monomoneda por grupo, así que el importador **rechaza el archivo entero** y
avisa si encuentra más de una; el usuario tendrá que separar o convertir antes. El export real
usado para el fixture es todo EUR.

**Cómo exportar (texto para el tutorial de la app).**

1. Abre **`splitwise.com` en el navegador**. La app móvil no tiene esta opción.
2. Entra al grupo.
3. Toca el engranaje del grupo.
4. Elige **«Export as spreadsheet»** / **«Exportar como hoja de cálculo»** y descarga el `.csv`.
5. Si lo haces desde el móvil, la web en el navegador descarga el archivo en el dispositivo.
6. En OweNo: **⋯ → Importar de Splitwise → Elegir archivo**.

## 2. JSON backup completo (Pro)

- Solo para suscriptores **Pro**.
- Web: nombre → **Your account** → **Advanced features** → **Download JSON backup**.
- Incluye **todos los datos de la cuenta**, no un grupo.
- El esquema no está documentado públicamente. Es la vía probable para tener **emails/IDs de
  usuarios** y poder autoenlazar por email, pero **necesito un backup redactado** para
  confirmarlo.
- No entra en v1 sin una muestra y sin decidir si el importador acepta un archivo de toda la
  cuenta o solo un grupo.

## 3. API self-serve

- `dev.splitwise.com`; OAuth/self-serve, con **rate limits** y condiciones que pueden exigir
  Pro.
- Endpoints útiles: `get_groups`, `get_expenses`, `get_comments`, `get_currencies`,
  `get_categories`.
- Los objetos de grupo/miembro de la API pueden incluir email; habría que confirmarlo.
- No entra en v1: exige OAuth, gestión de tokens y una integración externa; el CSV es suficiente
  para el primer importador.

## 4. Export por soporte

Splitwise ofrece pedir un export completo a `support@splitwise.com`. No es una vía automática
para la app; se documenta por si el propietario necesita recuperar datos que el CSV no cubre.

## Implicaciones para el importador de OweNo v1

1. **Un CSV por grupo**, no un export de toda la cuenta. La app pide el grupo destino y el
   archivo; no promete “importar todo Splitwise de una vez”.
2. **Solo una divisa por archivo/grupo**. Si hay más de una en la columna `Currency`, se rechaza
   con un mensaje claro y se pide separar/convertir.
3. **Los pagos se importan como liquidaciones**, no como gastos. Hay que verificar el marcador
   exacto con una muestra.
4. **El mapeo de personas es por nombre**, no por email. Autoenlace por email **no es posible
   desde el CSV**. Opciones:
   - Autoenlace por **nombre exacto y único**; si no, selector de usuarios activos o ficticio.
   - Soportar el **JSON backup** (Pro) para tener emails/IDs, si el esquema lo permite.
   - Pedir el email en el mapeo para las identidades sin coincidencia.
5. **Sin adjuntos, comentarios, recibos ni IDs estables**. El importador no puede deduplicar por
   `expense_id`; la deduplicación sería por hash de fila + lote, y se avisa.
6. **Todo el historial del grupo**, sin rango de fechas. Hay que limitar tamaño y avisar del
   tiempo de parseo.
7. **CSV de usuario**: validar tamaño, codificación, comillas, fechas y decimales; evitar
   fórmulas/CSV injection; no ejecutar nada del archivo.
8. **La app móvil** puede abrir el CSV desde el selector de archivos o desde “compartir con”;
   el parseo y la validación se hacen en el backend para que el resultado sea el mismo en web y
   móvil.

## Decisión (2026-11-12)

- El propietario **no tiene Pro**: v1 usa **solo el CSV por grupo**; no se soportan el JSON
  backup ni la API.
- El CSV no trae emails: el autoenlace es por **nombre exacto y único**; si no hay coincidencia,
  la app pregunta con qué usuario activo enlazarlo o permite crear un ficticio.
- No hay autoenlace por email en v1.
- Multi-divisa: se **rechaza y avisa**. El usuario separa o convierte antes de importar.

## Estado del parser

**Cerrado con la muestra del 2026-11-13** (grupo real, anonimizado en
`fixtures/splitwise-demo.csv`: 622 filas, 6 pagos, una sola divisa, una fila con coste vacío y
otra con celdas de espacios). Verificado: cabeceras en español, fecha ISO, decimal `.`, marcador
de pago en `Categoría`, impactos por persona que suman el coste.

Queda por confirmar solo si Splitwise **localiza las cabeceras en los otros idiomas** que soporta
la instancia (ca, it, fr, de, pt, gl, eu). El importador acepta ES y EN; si aparece otro idioma,
el error dirá qué columnas faltan y el usuario podrá exportar en ES/EN mientras se añade el
alias. No bloquea la implementación.

## Fuentes

- Splitwise Help Center, “How do I export my Splitwise data?”:
  <https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data> (consultado
  2026-11-12).
- Splitwise feedback/helpdesk, “Download/export Splitwise data”:
  <https://splitwise.uservoice.com/forums/162446-general/suggestions/3096099-download-export-splitwise-data>.
- SplitterUp, “How to Export Your Splitwise Data”:
  <https://splitterup.app/blog/export-splitwise-data>.
- FamZam, “How to Export Splitwise Data to CSV”:
  <https://famzam.app/blog/how-to-export-splitwise-data>.
- Splitwise API: <https://dev.splitwise.com>.
- dlt, Splitwise source (endpoints `get_expenses`, `get_groups`):
  <https://dlthub.com/context/source/splitwise>.
