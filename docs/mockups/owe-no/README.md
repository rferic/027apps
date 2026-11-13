# Mockup — OweNo (F1 móvil y F2 panel)

Mockup de la **tarea 06** del sprint 15. No es una imagen: es un HTML+JS navegable con las dos
superficies del módulo, para que el propietario recorra los flujos y apruebe antes de que se
escriba DDL, API o UI.

> **Estado:** **aprobado por el propietario el 2026-11-13**, junto con la spec
> [`2026-11-13-owe-no.md`](../../superpowers/specs/2026-11-13-owe-no.md) y el plan
> [`2026-11-13-owe-no.md`](../../superpowers/plans/2026-11-13-owe-no.md). Es el contrato de UI de
> las tareas 06 (panel) y 07 (móvil).

## Cómo abrirlo

```bash
open docs/mockups/owe-no/index.html
```

Arriba hay tres selectores de revisión —**superficie** (F1 móvil / F2 panel), **pantalla** y
**tema**— fuera del dispositivo a propósito: no son UI del producto, son controles para revisar.
También se puede abrir una pantalla concreta por URL:

```text
?screen=group                      # F1, detalle del grupo
?screen=import-map&theme=dark      # F1, mapeo del CSV en oscuro
?surface=panel&screen=module       # F2, ficha con el deslizador de configuración
?surface=panel&screen=overview     # F2, overview del módulo
```

## F1 · Móvil (390 px)

| Pantalla | Qué revisar |
|---|---|
| Inicio del shell | Widget de OweNo con deuda, grupos y el aviso de invitación pendiente. |
| **OweNo · al abrir el módulo** | La pantalla de entrada: cabecera fija con logo y nombre, tarjeta de resumen y lista de grupos. |
| **OweNo · menú ⋯** | Cómo se llega a Grupos, Invitaciones, Importar de Splitwise y Ajustes del módulo. |
| Grupos | Lista con saldo por grupo, activos y archivados. |
| Detalle | Balances por miembro, liquidación sugerida y gastos recientes. |
| Historial | Gastos y pagos en una sola lista; un movimiento se abre y se puede editar o eliminar. |
| Movimiento | Detalle con reparto, quién lo registró y acciones **Editar** / **Eliminar**, solo para el autor o el creador. |
| Confirmar borrado | Baja lógica: sale de balances y del historial, sin deshacer desde la app. |
| Alta de gasto | Importe, fecha, pagador, categoría, **selección de participantes** y reparto **igual**. Solo se reparte entre los marcados. |
| Gasto con subconjunto | El caso del viaje: 5 miembros, 3 helados, 4,50 € cada uno. |
| Reparto exacto | Un importe por persona, con el total repartido y la diferencia. |
| Liquidación | A quién se paga, importe y confirmación; un ficticio no puede pagar. |
| Invitaciones | Aceptar o rechazar; hasta aceptar no se ven gastos. |
| Miembros (creador) | Invitar, echar, bloquear y el aviso de deuda pendiente. |
| Salir del grupo | Saldo distinto de cero bloquea la salida. |
| Importar (4 pasos) | Archivo, preview, mapeo de identidades y resultado. |
| Grupo grande | Aviso de liquidación simplificada por encima del tope. |
| Estados | Vacío, cargando, error y sin conexión. |

## F2 · Panel (1440 px)

| Pantalla | Qué revisar |
|---|---|
| **Dashboard del panel** | El panel real con el **widget de panel** de OweNo entre los widgets de módulos. |
| Catálogo | Módulos dentro de Plataforma; OweNo activo y el resto no instalado. |
| **Ajustes del módulo** | Pestaña propia en `/modules/owe-no/settings`: **deslizador** de `settlement_exact_limit` (4–20, por defecto 12) con **hoja** a la izquierda y **llama** a la derecha, permisos y páginas. |
| Resumen | Migas `Plataforma / Módulos / OweNo` y pestañas secundarias; totales, actividad y deuda pendiente. |
| Grupos | Tabla con búsqueda y filtro; el admin crea, edita y archiva. |
| Detalle de grupo | Gastos (con «3 de 4» participantes), balances y miembros, sin editar dinero. |
| Importaciones | Historial y el rechazo por multi-divisa. |

D9: **no** hay sección «App» en el panel; las pantallas móviles se revisan aquí, no se duplican.

## Datos de demo

Familia e importes **inventados**; nunca datos reales. Los saldos están construidos para que la
liquidación exacta dé **menos pagos que `n−1`** (dos pagos para cuatro personas), y así se vea la
diferencia con el voraz.

## Previews

`preview-home.png`, `preview-module-home.png`, `preview-menu.png`, `preview-group.png`,
`preview-movement.png`, `preview-subset.png`, `preview-import.png`,
`preview-panel-dashboard.png`, `preview-panel-settings.png`, `preview-panel-overview.png` —
capturas de revisión rápida; el HTML es la fuente.
