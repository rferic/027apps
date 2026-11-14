# Fixtures de OweNo

## `splitwise-demo.csv`

Export de Splitwise **anonimizado** para probar el importador. No contiene datos reales.

- Origen: un export real de un grupo de dos personas (2026-11-13), con los nombres sustituidos
  por **Ana** y **Luis** y las descripciones reemplazadas por textos genéricos. Se conservan
  fechas, categorías, importes, divisa y los impactos por persona, que son lo que el parser
  necesita.
- 622 filas de datos, 6 de ellas pagos (`Categoría = Pago`), una sola divisa (EUR).
- Conserva dos irregularidades del export real, a propósito:
  - una fila con celdas de solo espacios;
  - una fila con `Coste` vacío pero impactos válidos (`+212.50` / `-212.50`), de la que el
    importador debe derivar el importe.
- Cabecera en **español**: `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis`. El parser debe
  aceptar también la cabecera en inglés (`Date,Description,Category,Cost,Currency,<persona>,…`).

Regeneración: si hace falta un export nuevo, se anonimiza igual — nombres a ficticios,
descripciones genéricas, sin tocar la estructura. **Nunca** se commitea el original.
