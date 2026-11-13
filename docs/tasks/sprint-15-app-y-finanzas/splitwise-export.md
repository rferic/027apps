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

**Dónde está.** En la web, dentro del grupo o amistad, icono de ajustes/engranaje →
**“Export as spreadsheet”**. La base de ayuda oficial (consultada 2026-11-12) dice que también
está en la app móvil: en la cabecera horizontal del grupo, al final, **“Export”**. Otras guías
dicen que solo está en web; conviene no depender de la app de Splitwise y aceptar el CSV
compartido o descargado desde la web.

**Alcance.** Es **por grupo o por amistad**, no por cuenta: hay que repetir la exportación por
cada grupo. No hay “exportar todo” en CSV. No hay filtro de fechas: sale todo el historial del
grupo.

**Formato.** CSV plano, una fila por transacción. Las columnas que describen las fuentes son:

- `Date`
- `Description`
- `Category`
- `Cost` (total de la transacción)
- `Currency` (divisa de esa fila)
- `Paid by` / quién pagó (según la versión del export)
- **una columna por persona** del grupo, con el **impacto en su balance** en esa transacción:
  positivo si pagó/gastó, negativo si debe.

La suma de las columnas de personas de una fila es cero (lo que uno paga, los demás lo deben).
Eso permite reconstruir el pagador y las partes sin depender de un formato de “shares” aparte.

**Qué incluye:**

- Gastos y **pagos** (“cuando gastan o hacen un pago, positivo; cuando deben, negativo”). Los
  pagos aparecen como transacciones; el importador puede convertirlos en liquidaciones.
- Categorías.
- Nombres de los participantes en las cabeceras.

**Qué no incluye:**

- **Emails.** El CSV identifica a las personas por **nombre**, no por email. Es el hallazgo que
  rompe el autoenlace por email desde el CSV.
- Comentarios, fotos de recibos, adjuntos, recordatorios, solicitudes de pago.
- Un identificador estable de gasto o de grupo (el archivo es del grupo; no hay `expense_id`).
- Un desglose de “reparto” separado: se deduce del impacto por persona.
- Garantía de que los gastos borrados no aparezcan o aparezcan; depende del momento del export.

**Multi-divisa.** Cada fila lleva su `Currency`. Un grupo de Splitwise puede tener gastos en
varias divisas. OweNo v1 es monomoneda por grupo, así que el importador **rechaza el archivo y
avisa** si encuentra más de una divisa; el usuario tendrá que separar o convertir antes.

**Pagos.** La base de ayuda confirma que los pagos van en el CSV como transacciones. Aun así,
el marcador exacto (categoría “Payment”, descripción, o solo el patrón de una persona positiva
y otra negativa) hay que verificarlo con un export real: es la diferencia entre importar una
liquidación y inventarse un gasto.

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

## Lo que falta para cerrar el parser

- Un **CSV redactado** de un grupo real (nombres y emails cambiados; importes pueden ser dummy).
- Si se quiere autoenlace por email: un **JSON backup redactado** (Pro) o confirmar que la API
  expone emails.
- Verificar en la muestra: cabeceras exactas, formato de fecha, separador decimal, fila de pago,
  fila de gasto negativo/reembolso, y si el grupo es mono o multi-divisa.

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
