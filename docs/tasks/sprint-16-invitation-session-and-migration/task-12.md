---
id: sprint-16-task-12
titulo: Eliminar una instancia guardada en la app
area: app
estado: test
plan: docs/tasks/sprint-16-invitation-session-and-migration/README.md
fuente: docs/tasks/backlog.md (entrada 6, absorbida)
adrs: [0007]
---

**Tarea**: poder quitar del selector de instancia una instancia que ya no se usa. Añadida el
2026-11-18 por orden del propietario al probar la migración por QR: en el móvil quedaban la
instancia de producción y la local sin forma de limpiar la que sobraba.

**Punto de partida**
- `InstanceStore.forget(url)` ya existía y estaba probado: quita la instancia de la lista, nunca el
  build por defecto, y si era la activa vuelve al default. Lo que faltaba era la interfaz.
- La app guarda **una** sesión (la de la instancia activa); una instancia inactiva no tiene sesión
  que cerrar.

**Alcance**
- Dentro:
  - `InstancePickerDialog`: botón «Quitar» en cada fila que no sea la activa ni el build por
    defecto, con diálogo de confirmación que nombra la instancia.
  - `AppViewModel.forgetInstance(url)`: rechaza la activa, delega en el store y refresca la lista
    sin reiniciar la app.
  - El selector deja de ofrecer la acción para la activa y para la de build: no hay forma de
    quedarse sin ninguna.
  - Textos en los 9 idiomas (`remove`, `removeInstanceTitle`, `removeInstanceBody`).
  - Tests del store: quitar una inactiva deja la activa; el build por defecto no se puede quitar.
- Fuera: borrar la sesión de otra instancia (no existe: hay un solo hueco de sesión), historial de
  instancias eliminadas y sincronización entre dispositivos.

**Criterios de aceptación**
- Una instancia inactiva se puede quitar desde login, Ajustes y la pantalla de fallo, con
  confirmación previa; desaparece de la lista al instante y sigue fuera tras reiniciar.
- La instancia activa y el build por defecto no ofrecen «Quitar».
- La sesión activa no se toca al quitar otra instancia.
- Los nueve idiomas tienen los textos y `AppStringsTest` lo comprueba.
- `./gradlew :app:testDebugUnitTest :app:assembleDebug` en verde.

**Hecho y verificado (2026-11-18, emulador)**
- El selector muestra «Quitar» solo en la instancia que no es la activa ni el build por defecto; al
  pulsarlo aparece «¿Quitar la instancia?» con la dirección dentro y, al confirmar, la fila
  desaparece y sigue fuera tras reiniciar la app.
- La instancia activa y la de producción no ofrecen la acción.
- Tests del store: quitar una inactiva deja la activa; el build por defecto no se puede quitar.
  `:app:testDebugUnitTest` y `:app:assembleDebug` en verde (InstanceStore 9/9).

**Riesgos**: que el selector quede con una selección que ya no existe (se corrige al confirmar: la
selección vuelve a la activa); que se confunda con «cerrar sesión» (el diálogo dice que solo se
olvida la dirección y que se puede volver a añadir).

**Auditoría de seguridad**: incluida en la revisión del sprint (`task-11-audits.md`): no hay
credenciales implicadas, la sesión activa no se modifica y la lista vive en preferencias locales.
