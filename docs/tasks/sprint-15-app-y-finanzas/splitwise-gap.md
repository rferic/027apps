# OweNo frente a Splitwise: qué mejorar (análisis, no copia)

> Análisis de producto del 2026-11-15 para el sprint 15. No es una spec: ordena huecos
> detectados comparando la app real (0.9.x) con Splitwise, con criterio de app familiar.
> Lo que entra en v1 se marca; el resto queda como backlog priorizado.

## Lo que ya hacemos igual o mejor

| Capacidad | OweNo | Nota |
|---|---|---|
| Grupos con miembros y saldos | Sí | Estados explícitos: invitado, activo, sin cuenta, bloqueado, salió, echado |
| Gasto con pagador y participantes | Sí | Reparto igual o importes exactos |
| Liquidación con pagos mínimos | Sí | Plan calculado en servidor |
| Registrar un pago manual | Sí | Con fecha |
| Categorías | Sí | Por grupo |
| Moneda por grupo con formato del perfil | Sí | Enteros en céntimos, sin coma flotante |
| Importar histórico | Sí | CSV de Splitwise, con mapeo de identidades |
| Push y realtime | Push sí, realtime pendiente | Tarea aparte |
| Multi-idioma y multi-instancia | 9 idiomas, instancias propias | Self-hosting real |
| Panel de administración | Sí | Splitwise no lo tiene |
| Widget de la home | Sí | Saldo y grupos |

## Huecos por impacto para una familia

### Alto valor, bajo coste

1. **Comentarios en un gasto.** Splitwise convierte el gasto en una conversación («esto lo pagué yo»).
   Nos falta el hilo; el dato ya lo permite (movimiento + autor). Coste: una tabla y una hoja.
2. **Totales y gasto por categoría.** Sin esto, las categorías son decorativas. Un resumen mensual
   en Balances («Este mes: 320 € · Casa 45 %») da valor inmediato con los datos que ya tenemos.
3. **Tu parte en el historial.** Hoy la fila dice descripción, pagador e importe; falta «tu parte:
   6,67 €» / «te toca pagar». Es la pregunta que se hace el usuario al abrir el grupo.
4. **Buscar y filtrar en Actividad.** Un buscador por texto y un filtro gastos/pagos resuelve el
   grupo con años de historia. Barato en cliente con los movimientos ya cargados.
5. **Recordatorio de deuda.** Con push ya montado, un «recordar» al deudor del plan de liquidación
   (con límite de frecuencia) es la función que más usa la gente en Splitwise.
6. **Adjuntar ticket.** Foto del recibo en el gasto; el módulo ya guarda movimientos, falta el
   almacenamiento y el permiso de cámara.

### Alto valor, coste medio

7. **Gastos recurrentes.** Alquiler, luz, suscripciones: se repiten solos cada mes. Requiere
   programación en servidor (ya existe infraestructura de tareas).
8. **Reparto por porcentajes o pesos.** Familias con ingresos distintos lo piden; hoy solo igual o
   exacto. Encaja en el mismo modelo de participaciones (suma invariante).
9. **Gasto entre dos personas fuera de un grupo.** Splitwise lo llama «amigos»; reduce fricción
   para un gasto puntual. En una familia puede resolverse con un grupo «Casa» y no es prioritario.
10. **Exportar a CSV desde la app.** El panel importa; exportar cierra la promesa de «tus datos son
    tuyos» y sirve de copia de seguridad manual.

### Bajo valor para este producto

11. Multi-divisa por gasto y conversión: una familia comparte una moneda. Se queda fuera.
12. Integraciones de pago (PayPal/Venmo): no aplica en autoalojado.
13. Simplificación de deudas configurable: ya liquidamos siempre con el plan mínimo; no hace falta
    interruptor.
14. Modo offline completo: la app avisa y reintenta; sincronización offline es un proyecto entero.

## Decisiones propuestas para v1

- Entran **3, 2 y 5** (tu parte, resumen mensual, recordatorio) por relación valor/coste y porque no
  tocan el modelo de dinero.
- **1 (comentarios)** entra si queda margen tras los arreglos de UX; si no, sprint 16.
- **7 (recurrentes)** es la siguiente función de producto, no un pulido.
- Nada de multi-divisa ni pasarelas: no es el producto.

## Criterio de aceptación del análisis

- Cada hueco tiene coste estimado y una decisión (v1 / backlog / fuera).
- Lo que entra se implementa con test y se prueba en la app real, no en maqueta.
