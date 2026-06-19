# Plan de Refactorización: Eliminación del concepto "settled" en Split Expenses

**Sprint:** 24 — Split Expenses  
**Rama:** `sprint/24-split-expenses`  
**Fecha:** 19 Junio 2026  
**Estado:** Pendiente de ejecución

---

## 1. Resumen Ejecutivo

### ¿Qué cambia?
Eliminamos el concepto de "gasto liquidado" (`settled: boolean`) de la app Split Expenses. El modelo pasa a ser **contable puro**:

- **Gasto** → registro histórico inmutable. Siempre visible, siempre editable, nunca "liquidado".
- **Transferencia** → pago real entre dos personas (`pending` → `completed` → `cancelled`). Es el único mecanismo para saldar deudas.
- **Balance** → `sum(gastos) - sum(transferencias_completadas)`

### ¿Por qué?
1. El `settled: boolean` impedía liquidaciones parciales
2. Un gasto con 3 participantes no se podía "liquidar a medias"
3. Hace meses convivían dos sistemas (gastos liquidados + pagos manuales)
4. El modelo contable puro es más simple y más potente

### ¿Qué ya está hecho?
- ✅ Pagos manuales con columna `is_manual` en transfers y endpoint `POST /payments`
- ✅ Botón ✓ en cada fila de transferencia sugerida (Balances tab)
- ✅ En `migrations.sql`: columna `settled` ya eliminada del CREATE TABLE de expenses

---

## 2. Cambios en Schema de BD

### 2.1 Nueva migración Supabase

Archivo: `supabase/migrations/20260619XXXXXX_drop_settled_and_settlement_items.sql`

```sql
-- 1. Eliminar columna settled de expenses (si existe en staging)
ALTER TABLE split_expenses_expenses DROP COLUMN IF EXISTS settled;

-- 2. Eliminar tabla settlement_items (ya no se usa)
DROP TABLE IF EXISTS split_expenses_settlement_items CASCADE;

-- 3. Eliminar índice huérfano (por si acaso)
DROP INDEX IF EXISTS idx_se_settlement_items_expense;
DROP INDEX IF EXISTS idx_se_settlement_items_settlement;
```

### 2.2 Actualizar `migrations.sql`

El archivo `apps/split-expenses/migrations.sql` (schema canónico) debe modificarse:

| Cambio | Líneas |
|---|---|
| Eliminar `DROP TABLE IF EXISTS split_expenses_settlement_items` | L3 |
| Eliminar `CREATE TABLE split_expenses_settlement_items (...)` | L83-88 |
| Eliminar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para settlement_items | L131 |
| Eliminar policies RLS para settlement_items | L300-320 |
| Eliminar `GRANT ... ON split_expenses_settlement_items TO service_role` | L348 |

**Total líneas eliminadas de migrations.sql:** ~30

### 2.3 Tabla `split_expenses_settlements`

Se **mantiene** como registro agrupador histórico. Cuando se crea una liquidación (desde Balances → "Liquidar todo"), se crea un registro en esta tabla + las transferencias correspondientes con `settlement_id` que las agrupa. Ya **no** tiene relación con `settlement_items` (esa tabla desaparece).

---

## 3. Cambios en API Endpoints

### 3.1 `routes/[id]/expenses/GET.ts` — Listado de gastos

**Cambios:**
1. Eliminar `settled` del `select()` (línea 29)
2. Eliminar el query param `settled` y su filtrado (líneas 19, 36-37)
3. Devolver TODOS los gastos siempre

**Antes:**
```ts
const settled = url.searchParams.get('settled')
// ...
db.from('split_expenses_expenses').select('..., settled, ...')
if (settled === 'true') query = query.eq('settled', true)
else if (settled === 'false') query = query.eq('settled', false)
```

**Después:**
```ts
// Sin settled query param ni filtro
db.from('split_expenses_expenses').select('..., ...') // sin 'settled' en select
```

### 3.2 NUEVO: `routes/[id]/transfers/GET.ts` — Listado de transferencias

Endpoint paginado para listar transferencias con perfiles de usuario. Necesario para el nuevo filtro de tipo en el frontend.

```
GET /api/v1/{groupSlug}/apps/split-expenses/{expenseGroupId}/transfers
  ?page=1
  &limit=20
  &status=completed|pending|cancelled  (opcional, default: completed)
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "from_user": "uuid",
      "to_user": "uuid",
      "amount": 40.00,
      "status": "completed",
      "is_manual": true,
      "note": "Cena viernes",
      "created_at": "2026-06-15T...",
      "from_name": "Bob",
      "to_name": "Alice"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 }
}
```

### 3.3 `routes/[id]/balances/GET.ts` — Cálculo de balances

**Cambios:**
1. Eliminar `.eq('settled', false)` de la query de expenses (línea 20)
2. Calcular sobre TODOS los gastos (no solo unsettled)
3. Restar TODAS las transferencias completadas (manuales + settlement)

**Antes:**
```ts
db.from('split_expenses_expenses')
  .select('id, paid_by, amount')
  .eq('expense_group_id', expenseGroupId)
  .eq('settled', false)  // ← eliminar esta línea
```

**Después:**
```ts
db.from('split_expenses_expenses')
  .select('id, paid_by, amount')
  .eq('expense_group_id', expenseGroupId)
  // sin filtro settled — TODOS los gastos
```

La lógica de restar pagos manuales ya existe (líneas 67-79) y debe ampliarse para restar también transfers de settlements completados (los que tienen `status = 'completed'` y `is_manual = false`).

### 3.4 `routes/[id]/settlements/POST.ts` — Crear liquidación

**Cambios:**
1. Eliminar `.eq('settled', false)` de las queries (líneas 34, 41)
2. Eliminar inserción en `split_expenses_settlement_items` (líneas 84-88)
3. Eliminar update de `settled: true` en expenses (líneas 91-93)
4. Para el caso "settle all" (sin `expense_ids`): calcular net balance (gastos − transfers completadas) y crear transfers para el remanente
5. Para el caso "settle specific" (con `expense_ids`): crear transfers basados en esos gastos específicos

**Antes (líneas 84-93):**
```ts
// Link expenses to settlement
await db.from('split_expenses_settlement_items').insert(settlementItems)

// Mark expenses as settled
await db.from('split_expenses_expenses')
  .update({ settled: true, updated_at: new Date().toISOString() })
  .in('id', settleIds)
```

**Después:**
```ts
// NADA — no linking, no marking as settled
// Solo crear transfers + settlement record
```

### 3.5 `routes/[id]/settlements/GET.ts` — Historial de liquidaciones

**Cambios:**
1. Eliminar queries a `split_expenses_settlement_items` (líneas 39, 47-53)
2. En lugar de cargar expenses vía settlement_items, cargar transfers vinculados por `settlement_id` directamente
3. Mantener el enriquecimiento con profiles

**Estructura actual** (usa settlement_items):
```
settlement → settlement_items → expense_ids → expenses
                               → count
```

**Estructura nueva** (usa transfers directamente):
```
settlement → transfers (where settlement_id = s.id)
```

### 3.6 `routes/[id]/settlements/[settlementId]/GET.ts` — Detalle de liquidación

**Cambios:**
1. Eliminar queries a `split_expenses_settlement_items` (líneas 20-21)
2. Eliminar carga de expenses vía items (líneas 26-27)
3. Simplificar: devolver solo settlement + transfers

### 3.7 `routes/[id]/stats/GET.ts` — Estadísticas

**Cambios:**
1. Eliminar `.eq('settled', false)` de la query de expenses (línea 24)

---

## 4. Cambios en Frontend (`view.tsx`)

### 4.1 Interface `Expense`

**Cambio:** Eliminar campo `settled` de la interfaz.

```ts
// Antes (línea 99):
interface Expense {
  // ...
  settled: boolean;
  // ...
}

// Después:
interface Expense {
  // ... (sin settled)
}
```

### 4.2 Estado del componente `GroupDetailView`

**Cambios:**
1. Eliminar estado `showSettled` (líneas 318-321)
2. Eliminar `localStorage.getItem('se-show-settled')`
3. Eliminar parámetro `settled` de las URLs de fetch (líneas 334, 366)
4. Eliminar props `showSettled` y `onToggleSettled` pasadas a `ExpensesTab`

### 4.3 Componente `ExpensesTab`

**Cambios:**
1. Eliminar estado `draftSettled` (línea 467)
2. Eliminar toggle "Mostrar liquidados" del modal de filtros (líneas 604-609)
3. Eliminar `showSettled` de `activeFilters` count (línea 484)
4. Eliminar `onToggleSettled` del botón "Limpiar filtros" (línea 543)

**NUEVO: Filtro de tipo** (`viewMode` → tipo de contenido):
```tsx
// Añadir estado: 'expenses' | 'transfers' | 'all'
const [contentType, setContentType] = useState<'expenses' | 'transfers' | 'all'>('expenses')
```

El selector toggle existente "Mis gastos" / "Todos" se convierte en un selector de 3 opciones:

```
[Gastos] [Transferencias] [Todo]
```

- **Gastos**: solo expenses (comportamiento actual, pero sin filtro settled)
- **Transferencias**: solo transfers (fetch del nuevo endpoint `GET /transfers`)
- **Todo**: expenses + transfers intercalados por fecha

### 4.4 Renderizado de items

**Cambios en el render de gastos (líneas 641-682):**
1. Eliminar estilos condicionales basados en `e.settled`:
   - Quitar `style={e.settled ? { background: '...', borderRadius: '...', border: '...' } : {}}` del div contenedor
   - Quitar `opacity: e.settled ? 0.75 : 1` del DsCard
   - Quitar `textDecoration: e.settled ? 'line-through' : 'none'` del título
   - Quitar `opacity: e.settled ? 0.5 : 1` del badge de tag
   - Quitar estilos condicionales de `paidBy` y montos
2. Eliminar el guard `!e.settled` del botón de eliminar (siempre mostrar)

**NUEVO: Render de transferencias en la lista**

Cuando `contentType` es `transfers` o `all`, se intercalan transfers con expenses ordenados por `created_at`. Cada transfer se renderiza como un item con:
- Icono `ArrowLeftRight` (verde)
- Texto: "Bob pagó €40 a Alice"
- Badge opcional: "Manual" si `is_manual === true`

### 4.5 Componente `ExpenseDetailModal`

**Cambios (líneas 886-988):**
1. Eliminar botón "Liquidar" con icono `Send` (líneas 932-936)
2. Eliminar modal de confirmación de liquidación (`showSettleConfirm`, líneas 951-969)
3. Eliminar guard condicional `!expense.settled` de los botones editar/eliminar (líneas 938-946)
4. Siempre mostrar botones de editar y eliminar
5. Eliminar import de `Send` si ya no se usa

### 4.6 Componente `BalancesTab`

**Sin cambios** — ya funciona con el modelo de pagos manuales + liquidación vía transfers. La función `handleSettle` (línea 1040) seguirá funcionando porque `settlements/POST.ts` se adapta para no usar `settled`.

**Posible mejora menor:** actualizar el modal de historial para mostrar solo transfers (sin expenses, ya que settlement_items desaparece).

---

## 5. Cambios en i18n

### 5.1 Claves a ELIMINAR de los 6 idiomas (en, es, ca, it, fr, de)

| Clave | Motivo |
|---|---|
| `expense.list.settled` | Ya no hay toggle "Mostrar liquidados" |
| `expense.item.settled` | Ya no hay badge "Liquidado" |
| `expense.item.lent` | No se usa (no hay referencias en el código) |
| `expense.item.owe` | No se usa (no hay referencias en el código) |
| `expense.item.total` | No se usa (no hay referencias en el código) |
| `expense.create.cantEditSettled` | Ya no hay gastos liquidados |
| `member.list.settled` | No se usa en members |

### 5.2 Claves a MODIFICAR

| Clave | Cambio |
|---|---|
| `balance.confirmMessage` | Eliminar referencia a "mark as settled". Nuevo texto: "This will create the following transfers:" |
| `balance.settleAll` | Mantener (botón en Balances tab) |
| `balance.settle` | Mantener (podría usarse en futuro) |

### 5.3 Claves NUEVAS a añadir

```json
{
  "expense": {
    "list": {
      "typeExpenses": "Expenses",
      "typeTransfers": "Transfers",
      "typeAll": "All"
    }
  },
  "transfer": {
    "item": {
      "paid": "paid",
      "from": "from",
      "to": "to",
      "manual": "Manual",
      "pending": "Pending",
      "completed": "Completed",
      "cancelled": "Cancelled"
    }
  }
}
```

### 5.4 Procedimiento para i18n

1. Modificar `en.json` primero
2. Ejecutar script de sincronización para copiar nuevas claves a los otros 5 idiomas
3. Traducir manualmente las nuevas claves en `es.json`
4. Avisar al usuario que reinicie el dev server (next-intl cachea los mensajes)

---

## 6. Orden de Implementación

### Fase 1: Schema (DB first)

| Paso | Tarea | Descripción |
|---|---|---|
| 1.1 | Crear migración Supabase | Archivo `20260619XXXXXX_drop_settled_and_settlement_items.sql` |
| 1.2 | Actualizar `migrations.sql` | Eliminar settlement_items del schema canónico |

### Fase 2: API (backend)

| Paso | Tarea | Descripción |
|---|---|---|
| 2.1 | `expenses/GET.ts` | Eliminar settled del select y query params |
| 2.2 | NUEVO `transfers/GET.ts` | Endpoint paginado de transferencias con profiles |
| 2.3 | `balances/GET.ts` | Eliminar `.eq('settled', false)`, restar todas las transfers completadas |
| 2.4 | `settlements/POST.ts` | Eliminar settlement_items insert, eliminar update settled |
| 2.5 | `settlements/GET.ts` | Reemplazar settlement_items por transfers directos |
| 2.6 | `settlements/[settlementId]/GET.ts` | Simplificar, eliminar dependencia de settlement_items |
| 2.7 | `stats/GET.ts` | Eliminar `.eq('settled', false)` |

### Fase 3: Frontend

| Paso | Tarea | Descripción |
|---|---|---|
| 3.1 | Eliminar `settled` de la interfaz `Expense` | TypeScript interface |
| 3.2 | Eliminar `showSettled` state y localStorage | `GroupDetailView` |
| 3.3 | Eliminar `draftSettled` y toggle del modal de filtros | `ExpensesTab` |
| 3.4 | Añadir filtro de tipo (Gastos/Transferencias/Todo) | `ExpensesTab` |
| 3.5 | Implementar fetch de transfers y render intercalado | `ExpensesTab` |
| 3.6 | Eliminar estilos condicionales `e.settled` del render | `ExpensesTab` |
| 3.7 | Eliminar botón "Liquidar" de ExpenseDetailModal | `ExpenseDetailModal` |
| 3.8 | Actualizar modal de historial en BalancesTab | `BalancesTab` |

### Fase 4: i18n

| Paso | Tarea | Descripción |
|---|---|---|
| 4.1 | Modificar `en.json` | Eliminar + añadir claves |
| 4.2 | Sincronizar + traducir otros 5 idiomas | Script + traducción manual |

### Fase 5: Verificación

| Paso | Tarea | Descripción |
|---|---|---|
| 5.1 | `pnpm tsc --noEmit` | Verificar tipos |
| 5.2 | `pnpm lint` | Verificar linting |
| 5.3 | `pnpm build` | Build completo |
| 5.4 | `test-frontend preview` | Verificación funcional en staging |

---

## 7. Riesgos y Consideraciones

### 7.1 Datos existentes en staging/producción

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La columna `settled` aún existe en staging/prod | El código intentará leerla aunque ya no esté en el select | La migración usa `DROP COLUMN IF EXISTS` — seguro |
| `settlement_items` tiene datos históricos | Se pierde la relación expenses↔settlement | El historial se reconstruye desde transfers vinculadas por `settlement_id` |
| Gastos previamente "settled" pierden ese estado | Vuelven a aparecer en balances | Es el comportamiento deseado — el balance neto se calcula con transfers completadas |
| Usuarios con gastos liquidados que no tienen transfers | Su balance cambiará inesperadamente | **Importante:** verificar en staging que no hay expenses con `settled=true` sin transfers asociadas. Si los hay, habrá que migrarlos creando transfers. |

### 7.2 Rollback

Si algo falla:
1. La migración de BD es **irreversible** (no se puede recrear la columna `settled` con los valores originales)
2. Se recomienda hacer backup de `split_expenses_expenses.settled` antes de dropear:
   ```sql
   CREATE TABLE split_expenses_expenses_settled_backup AS
   SELECT id, settled FROM split_expenses_expenses WHERE settled = true;
   ```
3. El código frontend puede revertirse volviendo al commit anterior

### 7.3 Impacto entre módulos

- **Widget de Split Expenses** (`widget.tsx` en i18n): no se modifica, funciona con balances
- **Otras apps**: sin impacto
- **Supabase RLS**: sin cambios (las policies de settlement_items se eliminan)

### 7.4 Convenciones

- Rama: se trabaja en `sprint/24-split-expenses` (ya existe)
- Commits: `[SPLIT-EXPENSES] descripción`
- PR: squash merge a `main`

---

## Apéndice: Checklist de Verificación

- [ ] `pnpm tsc --noEmit` pasa sin errores
- [ ] `pnpm lint` pasa sin errores
- [ ] `pnpm build` completa sin errores
- [ ] No hay referencias a `settled` en el código TypeScript
- [ ] No hay referencias a `settlement_items` en el código
- [ ] Las claves i18n eliminadas no se usan en ningún `.tsx`
- [ ] El nuevo endpoint `GET /transfers` devuelve datos correctos
- [ ] El filtro de tipo en frontend funciona (Gastos / Transferencias / Todo)
- [ ] Los balances se calculan correctamente con transfers completadas
- [ ] El historial de liquidaciones muestra transfers (no expenses)
- [ ] Probar en staging antes del merge
