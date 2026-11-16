---
id: sprint-16-panel-y-notificaciones
titulo: Panel usable y notificaciones bajo control
area: producto
estado: pendiente
---

Sprint **pendiente de aprobación**. Recoge lo que las pruebas del propietario en producción han ido
dejando anotado: el panel funciona, pero hay sitios donde no se entiende qué hacer, y las
notificaciones necesitan un interruptor propio.

## Alcance: cinco tareas

| # | Tarea | Por qué |
|---|---|---|
| 01 | **Importador del panel: control de subida claro** | El `<input type="file">` nativo no parece un botón; el propietario no supo cómo subir el CSV. Botón propio con el estilo del panel, arrastrar y soltar, nombre y tamaño del fichero, y el límite visible. Súbelo a 2 MB para igualar a la app. |
| 02 | **Importador atómico** | Hoy los miembros del mapeo se crean antes del commit; si el usuario cancela, el grupo queda tocado. El commit debe crear los miembros y los movimientos en la misma transacción. |
| 03 | **Interruptor de notificaciones push** | Apagar y encender desde Ajustes, revocando el dispositivo en el servidor (no basta con ignorar la notificación). El panel muestra el estado en la ficha del usuario. |
| 04 | **Editar liquidaciones** | Tocar un pago abre el formulario de gasto y el servidor lo rechaza. Modo edición en el formulario de pago. |
| 05 | **Idempotencia del import** | El alta de gastos ya la tiene. Cerrar el contrato del import: documentar que es idempotente por deducción de filas o extender la clave. |

## Fuera de alcance

- Cambios de diseño del panel: solo se corrige lo que impide o dificulta una tarea.
- Push por grupo: el interruptor es global en v1.
- Capturas reales en la web: siguen siendo simuladas hasta que la app esté probada.

## Criterios de aceptación

- Subir un CSV en el panel se entiende sin leer: un botón que lo dice, arrastrar y soltar, y el
  nombre del fichero a la vista. Verificado por el propietario en el preview.
- Cancelar un import no deja miembros nuevos en el grupo.
- Apagar las notificaciones revoca el dispositivo y el servidor deja de enviar (comprobado con un
  envío real).
- Una liquidación se corrige desde su propio formulario.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build` y `pnpm --filter db-tests test`
  en verde; auditoría de seguridad antes de `finalizada`.

## Puertas de usuario

- Aprobar este alcance para arrancar el sprint.
- Aceptar visualmente el importador en el preview.
- Orden explícita de merge.
