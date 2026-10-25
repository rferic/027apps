# ADR 0008 — Fechas y moneda: instantes UTC, fechas de calendario explícitas y dinero en enteros de céntimos

**Fecha:** 2026-10-25
**Estado:** Aceptada
**Decisora:** usuario (rferic), en conversación de diseño
**Base:** [spec de diseño §8](../superpowers/specs/2026-10-24-027apps-design.md) (`currency` y `exchange_rate` por transacción, `instance_settings`) · [§3 límites v1](../superpowers/specs/2026-10-24-027apps-design.md) (UI monomoneda por grupo, divisa original de cada transacción) · [§4 i18n](../superpowers/specs/2026-10-24-027apps-design.md) (claves en locales, check de CI) · [§12](../superpowers/specs/2026-10-24-027apps-design.md) (modelo contable puro, gastos inmutables + transfers) · [ADR 0004](0004-bordes-y-capa-de-aplicacion.md) (representación compartida, recurso con forma explícita) · [ADR 0007](0007-manejo-de-errores.md) (envelope de errores)
**Resuelve:** el ítem «fechas y moneda» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md). **Actualiza** el set de idiomas de la spec (§2 idiomas al lanzamiento, §4 «4 locales», §5 no-objetivo «6 idiomas al lanzamiento», §11 «es/ca/en/it») al set activable de 9 idiomas fijado aquí.

## Contexto

Los módulos (Split Expenses primero) manejan **fechas** y **dinero** a través de los bordes del sistema: la API `/api/v1`, MCP y el admin comparten la misma representación (ADR 0004 §7). El modelo de datos previsto guarda `currency` y `exchange_rate` por transacción, y la UI v1 es **monomoneda por grupo** aunque el modelo conserva la divisa original de cada transacción importada (§3, §8).

Dos riesgos si no se fija nada:
- **Dinero en coma flotante** (double/float) → errores de precisión acumulada en balances y splits (0.1 + 0.2 ≠ 0.3), inaceptable en una app de dinero donde las sumas deben cuadrar siempre (§12: modelo contable puro).
- **Fechas ambiguas** → interpretar un instante en la zona horaria equivocada: un gasto registrado "el día 25" por un miembro en UTC+10 y leído por otro en UTC-5 cambia de día. Una app **familiar** tiene miembros en zonas distintas por definición.

Además, la instalación de una instancia es el momento natural de fijar sus **preferencias generales** (zona horaria, moneda por defecto, idiomas activos): las define quien instala, una vez, en el **wizard de instalación** (el mismo del primer super_admin, spec de auth §3bis), y viven como **configuración general de la instancia** — no repartidas por el código ni por la cabeza de nadie.

## Decisión

### Configuración general de la instancia (fijada en el instalador)

0. El **wizard de instalación** pide y guarda como **configuración general de la instancia** (tabla `instance_settings`; el detalle de columnas lo fija el sprint de infra — **delta deliberada sobre §8**, que la define para secrets cifrados: aquí además guarda configuración no sensible en claro, compatible con su naturaleza clave-valor):
   - **Zona horaria** por defecto de la instancia.
   - **Moneda por defecto** de la plataforma (fallback para grupos que no definan la suya).
   - **Idiomas activos** (los que se sirven/verifican), elegidos de un set disponible fijo.
   - El set de idiomas disponible es: **`en, es, ca, it, fr, de, pt, gl, eu`** (9). Quien instala **habilita/deshabilita** sobre ese set; `en` no se puede deshabilitar (idioma base del código y de fallback). Los no activos simplemente no se sirven ni se exigen en el check de i18n.
   - Esto **actualiza** la lista «es/ca/en/it» de la spec §4/§11 (y los «4»/«6 idiomas» de §2/§5): el set pasa a los 9 anteriores, con activación por instancia.

### Fechas

1. **Instantes, en UTC, ISO 8601 con `Z`.** Todo momento en el tiempo (cuándo se creó, cuándo ocurrió) se serializa como `2026-10-25T15:04:05Z` y se almacena como `timestamptz`. El servidor **no opera instantes en otra zona**: los instantes canónicos son UTC.
2. **La zona horaria de la instancia (config general) es la zona por defecto para presentación e interpretación.** La usa el **cliente** (y los reportes) como zona de referencia cuando no hay una zona explícita del usuario; el valor por defecto arranca de ahí. Un perfil de usuario puede tener su propia zona para presentación personal (**delta deliberada sobre §8**, cuyo `profiles` solo tiene `locale`: se añade `timezone` al perfil, default = zona de la instancia); la de la instancia es el default.
3. **Las fechas de calendario que el dominio necesita se modelan como `date` explícito (sin hora, sin zona).** Cuando un dato es "el día X" y no "el instante X" — cumpleaños, aniversarios, y la **fecha del gasto** que el usuario fija en el formulario — se guarda `YYYY-MM-DD` como fecha de calendario, **no** derivada de un instante en una zona concreta. Así un cumpleaños no se desplaza con la zona horaria de quien lo ve.
   - La fecha del gasto la pone quien registra (su día local, como lo entiende la UI); es un `date` del formulario, no el `created_at`.
   - El instante de creación (`created_at`) se guarda aparte, en UTC.
4. **Agrupación por día (reportes, "gastos de hoy")** usa la **fecha de calendario guardada**, no el instante convertido — evita que el día de un gasto cambie según quién mire.
5. **Sin aritmética de fechas con zonas en el dominio**: los cálculos de "día" para reportes se hacen sobre `date` (días de calendario) o sobre instantes UTC (intervalos exactos de tiempo, p. ej. "últimos 24 h"), según el significado. La zona de instancia solo se aplica en el **borde de presentación/reportes** de forma explícita y determinista, nunca para decidir el valor canónico.

### Moneda

6. **Dinero como entero en la unidad menor (céntimos).** Todo importe se almacena, calcula y serializa como **entero de céntimos** (`amount_minor`, ej. 1234 = 12,34 €) + **código de moneda ISO 4217** (`currency`, ej. `EUR`). **Prohibido float/double y decimal de BD para operar dinero.** Enteros: sumas y splits exactos sin errores de redondeo acumulados.
   - En el wire JSON: `{ "amount_minor": 1234, "currency": "EUR" }` — entero seguro en JS/Kotlin/JSON (sin riesgo de precisión de coma flotante ni de `2^53` en el rango familiar).
7. **La moneda es del grupo/módulo; la de la instancia es el default.** La moneda efectiva de un módulo con dinero (ej. Split Expenses) se define **por grupo** (config del grupo/módulo). Un grupo nuevo **hereda la moneda por defecto** de la instancia (config general del instalador) salvo que se le asigne otra.
8. **La divisa original nunca se pierde.** Cada transacción guarda su `currency` y, si se importa o convierte, su `exchange_rate` (spec §8). Las conversiones solo se producen para **mostrar/balancear** y son explícitas; el dato canónico sigue siendo la divisa original. Multi-divisa completa y UI multimoneda quedan aplazadas (§3); este ADR fija el patrón para no perder datos desde v1.
9. **El tipo de cambio es la única excepción decimal** (es una ratio, no dinero): se guarda como decimal exacto (NUMERIC) y se aplica redondeando **a céntimo** en cada conversión. Nunca se "guardan céntimos con decimales".
10. **Redondeo determinista a céntimo.** En splits (v1: igual y exactos) y conversiones, si un reparto no da entero en céntimos, el **residuo se asigna a un participante concreto por una regla determinista** (p. ej. el último de la lista en orden estable), y el criterio queda documentado en la spec del módulo. Las sumas **siempre cuadran** (§12).
11. **El servidor no formatea.** El formateo (símbolo, separadores, posición, locale, moneda del usuario) es presentación del cliente (`Intl.NumberFormat` / `NumberFormat` de la plataforma). El recurso de la API expone `amount_minor` + `currency`; nunca una cadena ya formateada como dato canónico.

### Cómo se hace cumplir (esta decisión no se olvida)

La lección §12 del proyecto (anti-patrón "convenciones en la cabeza") se aplica aquí con un mecanismo de **tres niveles**; el detalle operativo se fija en la estrategia de testing y el [DoD](../conventions/definition-of-done.md):

- **Nivel 1 — Determinista (la herramienta falla):** schemas zod + tipos compartidos (`AmountMinor`, `Currency`, `DateString`, `Timestamp`) que toda puerta debe importar; reglas ESLint propias (p. ej. `no-money-float`, `no-server-tz`); **check de i18n en CI determinista**: como el CI corre sobre el repo sin una instancia viva, el set de locales verificado no sale de `instance_settings` en runtime — se fija un **set commiteado en el repo** (config/seed que refleja los locales servidos por la instancia) y el check falla si los locales de ese set no tienen exactamente las mismas claves; los locales deshabilitados en una instancia concreta no se sirven (decisión runtime), pero el check de CI valida el set completo que el código es capaz de servir; helpers únicos testeados de redondeo determinista y conversión (con test "las sumas cuadran siempre").
- **Nivel 2 — Proceso (lo verifica un agente distinto):** cada tarea de código declara en su frontmatter `adrs: [0008, …]`; el DoD exige "cumplimiento de ADRs aplicables"; la revisión QA/seguridad incluye esos ADRs en su checklist.
- **Nivel 3 — Contexto (el agente lo sabe al empezar):** la skill de proyecto `new-module` (ya prevista en spec §9/§11) inyecta los ADRs aplicables y los ejemplos de uso correcto al crear un módulo; si en el futuro se crea una skill `core-patterns`, se hace sobre la misma base.

## Alternativas consideradas

- **Decimal/`NUMERIC` en BD para dinero:** descartado como operación canónica — añade reglas de redondeo por operación y riesgo de redondeos bancarios inconsistentes entre lenguajes; el entero de céntimos es determinista y directo en todos los clientes. (El `NUMERIC` se reserva solo para el tipo de cambio, punto 9.)
- **String decimal en el wire (`"12.34"`):** descartado — el entero de céntimos es más directo de validar (zod) y operar, y no admite más decimales de los debidos.
- **Flotante en el wire o en BD:** descartado — precisión no garantizada en sumas y splits (§12 exige que cuadre siempre).
- **Fechas como `date` con zona horaria del grupo:** descartado — no existe "la zona del grupo" con miembros en zonas distintas; el `date` explícito evita el problema de raíz para calendario, y los instantes van en UTC para el resto. (La zona de la instancia es solo el default de presentación, punto 2.)
- **El servidor guarda/formatea en la zona del servidor:** descartado — la zona es presentación; los instantes canónicos son UTC y la zona de instancia se aplica solo en el borde de presentación (punto 5).
- **Zona/moneda/idiomas sin configuración general (cada instancia los hardcodea):** descartado — reproduciría el "en la cabeza de nadie" del legacy; el instalador los fija una vez y viven en `instance_settings`.

## Consecuencias

- Schemas zod y recursos de la API v1: `amount_minor` (entero) + `currency`, y `date`/`timestamp` con formatos fijos ISO 8601 — validados en el borde (ADR 0004 §3).
- El Core define helpers compartidos de **redondeo determinista** y de **conversión con tipo de cambio** (con su test: las sumas cuadran siempre), usados por los casos de uso de Split Expenses.
- El **wizard de instalación** (spec de auth §3bis) incorpora los pasos de zona horaria, moneda por defecto e idiomas activos, guardándolos en `instance_settings`; la spec del sprint de infra los detalla.
- La **config general de idiomas** alimenta el check de i18n: los locales activos se sincronizan y verifican (set commiteado en el repo, ver Nivel 1); los deshabilitados en una instancia no se sirven.
- La spec del módulo Split Expenses detalla la regla de reparto (quién recibe el residuo) sobre esta base.
- Los clientes formatean con el locale del usuario; `profiles.locale` arranca del default de la instancia.
- La regla de importación (Splitwise) conserva divisa original + tipo de cambio por transacción (spec §8), listo para multi-divisa futura.
- El ADR de errores (0007) y este conviven: los errores de validación de moneda/fecha usan el envelope del 0007 (p. ej. `validation_failed` con `details` del campo `amount_minor`).
- **El cumplimiento de esta decisión** queda garantizado por el mecanismo de tres niveles de la sección «Cómo se hace cumplir» + el punto de ADRs aplicables del DoD.
